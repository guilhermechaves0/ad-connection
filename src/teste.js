"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Importar módulos
var ldap = require("ldapjs");
var express = require("express");
var app = express();
var port = 3000;
// Função para decodificar strings com caracteres escapados para UTF-8
function safeDecodeURIComponent(escapedStr) {
    try {
        // Verificar se a string é válida para ser decodificada
        return decodeURIComponent(escapedStr);
    }
    catch (e) {
        if (e instanceof URIError) {
            console.error("Error decoding string:", e.message);
        }
        else {
            console.error("Unknown error:", e);
        }
        return escapedStr; // Retorna a string original em caso de erro
    }
}
// Função auxiliar para fazer a conexão LDAP e buscar o sAMAccountName
function searchSAMAccountName(sAMAccountName, callback) {
    var client = ldap.createClient({
        url: "ldap://10.26.0.12:389",
    });
    // Conectar-se ao servidor LDAP
    client.bind("06826732505@EDUC.GOVRN", "lighter", function (err) {
        if (err) {
            console.error("Error in bind:", err);
            callback(err, null);
            return;
        }
        // Configuração da busca
        var searchOptions = {
            filter: "(sAMAccountName=".concat(sAMAccountName, ")"),
            scope: "sub",
            attributes: ["*"], // Busca todos os atributos
        };
        // Realizar a busca no LDAP
        client.search("dc=EDUC,dc=GOVRN", searchOptions, function (err, res) {
            if (err) {
                console.error("Search error:", err);
                callback(err, null);
                return;
            }
            var result = [];
            // Processar as entradas encontradas
            res.on("searchEntry", function (entry) {
                var ldapEntry = {
                    sAMAccountName: "", // Inicialmente vazio
                    objectName: entry.dn.toString(), // Usando o Distinguished Name (DN) como o objectName
                };
                // Iterar sobre todos os atributos e adicioná-los ao resultado
                entry.attributes.forEach(function (attribute) {
                    if (attribute.type === "sAMAccountName") {
                        ldapEntry.sAMAccountName = safeDecodeURIComponent(attribute.values[0]);
                    }
                    // Verificar se `attribute.values` é uma string ou um array de strings
                    if (Array.isArray(attribute.values)) {
                        ldapEntry[attribute.type] = attribute.values.map(function (val) {
                            return safeDecodeURIComponent(val);
                        });
                    }
                    else {
                        ldapEntry[attribute.type] = safeDecodeURIComponent(attribute.values);
                    }
                });
                result.push(ldapEntry);
            });
            res.on("end", function (resultCode) {
                client.unbind();
                callback(null, result);
            });
            res.on("error", function (err) {
                console.error("Search error:", err);
                callback(err, null);
            });
        });
    });
}
// Definir a rota que vai buscar o sAMAccountName
app.get("/ldap/:sAMAccountName", function (req, res) {
    var sAMAccountName = req.params.sAMAccountName;
    searchSAMAccountName(sAMAccountName, function (err, result) {
        if (err) {
            return res.status(500).json({ error: "Error fetching LDAP data" });
        }
        if (result && result.length === 0) {
            return res.status(404).json({ message: "No entries found" });
        }
        res.json(result);
    });
});
// Iniciar o servidor
app.listen(port, function () {
    console.log("Server is running on http://localhost:".concat(port));
});
