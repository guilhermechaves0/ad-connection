"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Importar módulos
require("dotenv").config();
const ldap = __importStar(require("ldapjs"));
const express_1 = __importDefault(require("express")); // Corrigido importação do express
const app = (0, express_1.default)();
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
    const client = ldap.createClient({
        url: `${process.env.LDAP_URL}`,
    });
    // Conectar-se ao servidor LDAP
    client.bind(`${process.env.LOGIN}`, `${process.env.PASSWORD}`, (err) => {
        if (err) {
            console.error("Error in bind:", err);
            callback(err, false);
            return;
        }
        // Configuração da busca
        const searchOptions = {
            filter: `(sAMAccountName=${sAMAccountName})`,
            scope: "sub",
            attributes: ["sAMAccountName"], // Busca apenas o sAMAccountName
        };
        // Realizar a busca no LDAP
        client.search(`${process.env.DC_PRIMARY},${process.env.DC_SECONDARY}`, searchOptions, (err, res) => {
            if (err) {
                console.error("Search error:", err);
                callback(err, false);
                return;
            }
            let userFound = false;
            // Processar as entradas encontradas
            res.on("searchEntry", (entry) => {
                if (entry.attributes.some((attr) => attr.type === "sAMAccountName")) {
                    userFound = true; // Usuário encontrado
                }
            });
            res.on("end", () => {
                client.unbind();
                callback(null, userFound);
            });
            res.on("error", (err) => {
                console.error("Search error:", err);
                callback(err, false);
            });
        });
    });
}
// Definir a rota que vai buscar o sAMAccountName
app.get("/ldap/:sAMAccountName", (req, res) => {
    const sAMAccountName = req.params.sAMAccountName;
    searchSAMAccountName(sAMAccountName, (err, userFound) => {
        if (err) {
            return res.status(500).json({ error: "Error fetching LDAP data" });
        }
        if (userFound) {
            return res.json({ success: true, message: "User found in LDAP" }); // Corrigido "sucess" para "success"
        }
        else {
            return res
                .status(404)
                .json({ success: false, message: "User not found in LDAP" }); // Corrigido "sucess" para "success"
        }
    });
});
// Iniciar o servidor
app.listen(process.env.PORT_ACESS, () => {
    console.log(`Server is running on ${process.env.HOST_ACESS}:${process.env.PORT_ACESS}`);
});
