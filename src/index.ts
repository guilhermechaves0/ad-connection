// Importar módulos
import * as ldap from 'ldapjs';
import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';

const express = require('express');

const app = express();
const port = 3000;

// Definir o tipo de entry
interface LdapEntry {
    sAMAccountName: string;
    objectName: string;
}

// Função para decodificar strings com caracteres escapados para UTF-8
function decodeUTF8String(escapedStr: string): string {
    try {
        return decodeURIComponent(escapedStr.replace(/\\+/g, '%'));
    } catch (e) {
        console.error('Error decoding string:', e);
        return escapedStr; // Retorna a string original em caso de erro
    }
}

// Função auxiliar para fazer a conexão LDAP e buscar o sAMAccountName
function searchSAMAccountName(sAMAccountName: string, callback: (err: Error | null, result: LdapEntry[] | null) => void) {
    const client = ldap.createClient({
        url: 'ldap://10.26.0.12:389'
    });

    // Conectar-se ao servidor LDAP
    client.bind('06826732505@EDUC.GOVRN', 'lighter', (err) => {
        if (err) {
            console.error('Error in bind:', err);
            callback(err, null);
            return;
        }

        // Configuração da busca
        const searchOptions: ldap.SearchOptions = {
            filter: `(sAMAccountName=${sAMAccountName})`,
            scope: 'sub',
            attributes: ['sAMAccountName']
        };

        // Realizar a busca no LDAP
        client.search('dc=EDUC,dc=GOVRN', searchOptions, (err, res) => {
            if (err) {
                console.error('Search error:', err);
                callback(err, null);
                return;
            }

            let result: LdapEntry[] = [];

            // Processar as entradas encontradas
            res.on('searchEntry', (entry) => {
                console.log('LDAP entry object:', entry.pojo);

                // Decodificar objectName
                const decodedObjectName = decodeUTF8String(entry.pojo.objectName); // Decodificar a string escapada

                // Decodificar os valores escapados para UTF-8
                const ldapEntryAttributes = entry.pojo.attributes.find(attr => attr.type === 'sAMAccountName');
                if (ldapEntryAttributes && ldapEntryAttributes.values && ldapEntryAttributes.values[0]) {
                    const decodedName = decodeUTF8String(ldapEntryAttributes.values[0]); // Decodificar o nome
                    const ldapEntry: LdapEntry = { sAMAccountName: decodedName, objectName: decodedObjectName };
                    console.log('LDAP entry found:', ldapEntry);
                    result.push(ldapEntry);
                } else {
                    console.log('No valid entry found');
                }
            });

            res.on('end', (resultCode: number) => {
                client.unbind();
                callback(null, result);
            });

            res.on('error', (err) => {
                console.error('Search error:', err);
                callback(err, null);
            });
        });
    });
}

// Definir a rota que vai buscar o sAMAccountName
app.get('/ldap/:sAMAccountName', (req: Request<{ sAMAccountName: string }>, res: Response) => {
    const sAMAccountName = req.params.sAMAccountName;

    searchSAMAccountName(sAMAccountName, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching LDAP data' });
        }

        if (result && result.length === 0) {
            return res.status(404).json({ message: 'No entries found' });
        }

        res.json(result);
    });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
