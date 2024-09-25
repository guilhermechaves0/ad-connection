// Importar módulos
require("dotenv").config();
import * as ldap from "ldapjs";
import express, { Request, Response } from "express"; // Corrigido importação do express

const app = express();

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
  callback: (err: Error | null, result: boolean) => void
) {
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
    const searchOptions: ldap.SearchOptions = {
      filter: `(sAMAccountName=${sAMAccountName})`,
      scope: "sub",
      attributes: ["sAMAccountName"], // Busca apenas o sAMAccountName
    };

    // Realizar a busca no LDAP
    client.search(
      `${process.env.DC_PRIMARY},${process.env.DC_SECONDARY}`,
      searchOptions,
      (err, res) => {
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
      }
    );
  });
}

// Definir a rota que vai buscar o sAMAccountName
app.get(
  "/ldap/:sAMAccountName",
  (req: Request<{ sAMAccountName: string }>, res: Response) => {
    const sAMAccountName = req.params.sAMAccountName;

    searchSAMAccountName(sAMAccountName, (err, userFound) => {
      if (err) {
        return res.status(500).json({ error: "Error fetching LDAP data" });
      }

      if (userFound) {
        return res.json({ success: true, message: "User found in LDAP" }); // Corrigido "sucess" para "success"
      } else {
        return res
          .status(404)
          .json({ success: false, message: "User not found in LDAP" }); // Corrigido "sucess" para "success"
      }
    });
  }
);

// Iniciar o servidor
app.listen(process.env.PORT_ACESS, () => {
  console.log(
    `Server is running on ${process.env.HOST_ACESS}:${process.env.PORT_ACESS}`
  );
});
