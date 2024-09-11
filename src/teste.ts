// Importar módulos
import * as ldap from "ldapjs";
import { Request, Response } from "express";

const express = require("express");

const app = express();
const port = 3000;

// Definir o tipo de entry
interface LdapEntry {
  sAMAccountName: string;
  objectName: string;
  [key: string]: any; // Permitir armazenar outros atributos dinamicamente
}

// Função para decodificar strings com caracteres escapados para UTF-8
function safeDecodeURIComponent(escapedStr: string): string {
  try {
    // Verificar se a string é válida para ser decodificada
    return decodeURIComponent(escapedStr);
  } catch (e) {
    if (e instanceof URIError) {
      console.error("Error decoding string:", e.message);
    } else {
      console.error("Unknown error:", e);
    }
    return escapedStr; // Retorna a string original em caso de erro
  }
}

// Função auxiliar para fazer a conexão LDAP e buscar o sAMAccountName
function searchSAMAccountName(
  sAMAccountName: string,
  callback: (err: Error | null, result: LdapEntry[] | null) => void
) {
  const client = ldap.createClient({
    url: "ldap://10.26.0.12:389",
  });

  // Conectar-se ao servidor LDAP
  client.bind("06826732505@EDUC.GOVRN", "lighter", (err) => {
    if (err) {
      console.error("Error in bind:", err);
      callback(err, null);
      return;
    }

    // Configuração da busca
    const searchOptions: ldap.SearchOptions = {
      filter: `(sAMAccountName=${sAMAccountName})`,
      scope: "sub",
      attributes: ["*"], // Busca todos os atributos
    };

    // Realizar a busca no LDAP
    client.search("dc=EDUC,dc=GOVRN", searchOptions, (err, res) => {
      if (err) {
        console.error("Search error:", err);
        callback(err, null);
        return;
      }

      let result: LdapEntry[] = [];

      // Processar as entradas encontradas
      res.on("searchEntry", (entry) => {
        const ldapEntry: LdapEntry = {
          sAMAccountName: "", // Inicialmente vazio
          objectName: entry.dn.toString(), // Usando o Distinguished Name (DN) como o objectName
        };

        // Iterar sobre todos os atributos e adicioná-los ao resultado
        entry.attributes.forEach((attribute) => {
          if (attribute.type === "sAMAccountName") {
            ldapEntry.sAMAccountName = safeDecodeURIComponent(
              attribute.values[0]
            );
          }

          // Verificar se `attribute.values` é uma string ou um array de strings
          if (Array.isArray(attribute.values)) {
            ldapEntry[attribute.type] = attribute.values.map((val: string) =>
              safeDecodeURIComponent(val)
            );
          } else {
            ldapEntry[attribute.type] = safeDecodeURIComponent(
              attribute.values as string
            );
          }
        });

        result.push(ldapEntry);
      });

      res.on("end", (resultCode: number) => {
        client.unbind();
        callback(null, result);
      });

      res.on("error", (err) => {
        console.error("Search error:", err);
        callback(err, null);
      });
    });
  });
}

// Definir a rota que vai buscar o sAMAccountName
app.get(
  "/ldap/:sAMAccountName",
  (req: Request<{ sAMAccountName: string }>, res: Response) => {
    const sAMAccountName = req.params.sAMAccountName;

    searchSAMAccountName(sAMAccountName, (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Error fetching LDAP data" });
      }

      if (result && result.length === 0) {
        return res.status(404).json({ message: "No entries found" });
      }

      res.json(result);
    });
  }
);

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
