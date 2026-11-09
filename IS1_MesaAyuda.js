
/*-----------------------------------------------------------------------------------------------------------------
//*  MesaAyuda.js debe copiarse al directorio del proyecto express como index.js
//*
//*  REST API 
//*  UADER - FCyT - Ingenieria de Software I 
//*  Caso de estudio MesaAyuda
//*
//*  Dr. Pedro E. Colla 2023,2025
 *----------------------------------------------------------------------------------------------------------------*/
//AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE=1

import express from 'express';
import crypto from 'crypto';
console.log("Comenzando servidor");

// const crypto = require('crypto');
console.log("crypto Ok!");

//const express = require('express');
//console.log("express Ok!");

const app = express();
console.log("express ready!");

const PORT = 8080;

import cors from 'cors';

//const cors = require('cors');
console.log("cors ok!");

app.use(cors());
console.log("CORS ready!");

import AWS from 'aws-sdk'
//var AWS = require('aws-sdk');
console.log("aws-sdk ready!");

/*----
Acquire critical security resources from an external file out of the path
*/

//const accessKeyId = require('../accessKeyId.js');
//const secretAccessKey = require('../secretAccessKey.js');

import accessKeyId from '../accessKeyId.js';
import secretAccessKey  from '../secretAccessKey.js';

let awsConfig = {
    "region"         : "us-east-1",
    "endpoint"       : "http://dynamodb.us-east-1.amazonaws.com",
    "accessKeyId"    : accessKeyId, 
    "secretAccessKey": secretAccessKey
};

AWS.config.update(awsConfig);
console.log("Servidor listo!");
let docClient = new AWS.DynamoDB.DocumentClient();

/*----
   Application server in LISTEN mode
*/

app.listen(
    PORT,
    () => console.log(`Servidor listo en http://localhost:${PORT}`)
);

app.use(express.json());

/*-------------------------------------------------------------------------------------------
                            Funciones y Servicios
 *-------------------------------------------------------------------------------------------*/

/*-----------
función para hacer el parse de un archivo JSON
*/
function jsonParser(keyValue,stringValue) {
    var string = JSON.stringify(stringValue);
    var objectValue = JSON.parse(string);
    return objectValue[keyValue];
}

/*-------------------------------------------------------------------------------------------
                            SERVER API 
 *-------------------------------------------------------------------------------------------*/
/*==*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*
 *                       API REST Cliente                                                   *
 *=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*==*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*/

app.get('/api/cliente', (req,res) => {
    res.status(200).send({response : "OK", message : "API Ready"});
    console.log("API cliente: OK");
});


/*---
  /api/loginCliente
  Esta API permite acceder a un cliente por ID y comparar la password pasada en un JSON en el cuerpo con la indicada en el DB
*/  
app.post('/api/loginCliente', (req,res) => {

    const { id } = req.body;
    const {password} = req.body;

    console.log("loginCliente: id("+id+")");

    if (!password) {
        res.status(400).send({response : "ERROR" , message : "Password no informada"});
        return;
    }    
    if (!id) {
        res.status(400).send({response : "ERROR" , message : "id no informado"});
        return;
    }    

    let getClienteByKey = function () {
        var params = {
            TableName: "cliente",
            Key: {
                "id" : id
            }
        };
        docClient.get(params, function (err, data) {
            if (err) {
                res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+err}));
            }
            else {
                if (Object.keys(data).length == 0) {
                    res.status(400).send({response : "ERROR" , message : "Cliente invalido"});
                } else {
                    const paswd=jsonParser('password',data.Item);
                    const activo=jsonParser('activo',data.Item);
                    const id=jsonParser('id',data.Item);
                    const contacto=jsonParser('contacto',data.Item);
                    if (password == paswd) {
                        if (activo == true) {
                            const nombre=jsonParser('nombre',data.Item);
                            const fecha_ultimo_ingreso=jsonParser('fecha_ultimo_ingreso',data.Item);
                            res.status(200).send(JSON.stringify({response : "OK", "id" : id, "nombre" : nombre, "contacto" : contacto, "fecha_ultimo_ingreso": fecha_ultimo_ingreso}));    
                        } else {
                            res.status(400).send(JSON.stringify({response : "ERROR", message : "Cliente no activo"}));    
                        }
                    } else {
                       res.status(400).send({ response: "invalido", message: "usuario incorrecto" });
                    }    
            }    
            }
        })
    }
    getClienteByKey();

});

//Agregado para hacer que ingrese con contacto (e-mail) y password, en lugar de id y password. Esto es más amigable para el usuario.

/*---------
Función para realizar el SCAN de la tabla cliente filtrando por contacto (e-mail)
*/
async function scanDbContacto(contacto) {
    const paramsScan = {
        TableName: "cliente",
        FilterExpression: 'contacto = :contacto',
        ExpressionAttributeValues: { ':contacto': contacto }
    };
    const data = await docClient.scan(paramsScan).promise();
    return data.Items;
}

/*---
  /api/loginClienteEmail
  Accede a un cliente por contacto (e-mail) y compara la password recibida en el JSON con la del DB.
  La password nunca se devuelve al cliente.
*/
app.post('/api/loginClienteEmail', (req, res) => {

    const { contacto, password } = req.body;

    console.log("loginClienteEmail: contacto(" + contacto + ")");

    if (!contacto) {
        res.status(400).send({ response: "ERROR", message: "Contacto no informado" });
        return;
    }
    if (!password) {
        res.status(400).send({ response: "ERROR", message: "Password no informada" });
        return;
    }

    scanDbContacto(contacto)
    .then(async items => {
        if (!items || items.length == 0) {
            res.status(400).send({ response: "invalido", message: "Cliente invalido" });
            return;
        }
        const cliente = items[0];

        if (cliente.password != password) {
            res.status(400).send({ response: "invalido", message: "usuario incorrecto" });
            return;
        }
        if (cliente.activo != true) {
            res.status(400).send({ response: "ERROR", message: "Cliente no activo" });
            return;
        }
        // Actualiza la fecha de último ingreso con la fecha de hoy (dd/mm/aaaa)
        const hoy = new Date();
        const fechaHoy = String(hoy.getDate()).padStart(2, "0") + "/" + String(hoy.getMonth() + 1).padStart(2, "0") + "/" + hoy.getFullYear();
        await docClient.update({
            TableName: "cliente",
            Key: { "id": cliente.id },
            ExpressionAttributeNames: { "#f": "fecha_ultimo_ingreso" },
            ExpressionAttributeValues: { ":f": fechaHoy },
            UpdateExpression: "SET #f = :f"
        }).promise();
        cliente.fecha_ultimo_ingreso = fechaHoy;
        res.status(200).send(JSON.stringify({
            response: "OK",
            id: cliente.id,
            nombre: cliente.nombre,
            contacto: cliente.contacto,
            fecha_ultimo_ingreso: cliente.fecha_ultimo_ingreso
        }));
    })
    .catch(err => {
        res.status(400).send({ response: "ERROR", message: "DB access error " + err });
    });
});

//fin del agregado para login con contacto (e-mail) y password

/*----------
  /api/existeCliente
  Informa si existe un cliente con el contacto (e-mail) indicado. No devuelve ningún dato del cliente.
*/
app.post('/api/existeCliente', (req, res) => {

    const { contacto } = req.body;
    console.log("existeCliente: contacto(" + contacto + ")");

    if (!contacto) {
        res.status(400).send({ response: "ERROR", message: "Contacto no informado" });
        return;
    }

    scanDbContacto(contacto)
    .then(items => {
        const existe = (items && items.length > 0);
        res.status(200).send(JSON.stringify({ response: "OK", existe: existe }));
    })
    .catch(err => {
        res.status(400).send({ response: "ERROR", message: "DB access error " + err });
    });
});


/*-----------
  /api/getCliente
  Esta API permite acceder a un cliente dado su id
*/

app.post('/api/getCliente/:id', (req,res) => {
    const { id } = req.params;
    console.log("getCliente: id("+id+")");
    var params = {
        TableName: "cliente",
        Key: {
            "id" : id
            //test use "id": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"   
             }
        };
    docClient.get(params, function (err, data) {
        if (err)  {
            res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+ null}));
        } else {

            if (Object.keys(data).length != 0) {
               delete data.Item.password;   // se quita la password antes de responder
                res.status(200).send(JSON.stringify({"response":"OK","cliente" : data.Item}),null,2);
            } else {
               res.status(400).send(JSON.stringify({"response":"ERROR",message : "Cliente no existe"}),null,2);
            }
        }    
    })


} );

/*---------
Función para realizar el SCAN de un DB de cliente usando contacto como clave para la búsqueda (no es clave formal del DB)
*/
async function scanDb(contacto) {
    var docClient = new AWS.DynamoDB.DocumentClient();
    const scanKey=contacto;
    const paramsScan = { // ScanInput
      TableName: "cliente", // required
      Select: "ALL_ATTRIBUTES" || "ALL_PROJECTED_ATTRIBUTES" || "SPECIFIC_ATTRIBUTES" || "COUNT",
      FilterExpression : 'contacto = :contacto',
      ExpressionAttributeValues : {':contacto' : scanKey}
    };      
    var objectPromise = await docClient.scan(paramsScan).promise().then((data) => {
          return data.Items 
    });  
    return objectPromise;
}

/*----
addCliente
Revisa si el contacto (e-mail) existe y en caso que no da de alta el cliente generando un id al azar
*/
app.post('/api/addCliente', (req,res) => {

    const {contacto} = req.body;
    const {password} = req.body;
    const {nombre}   = req.body;
    console.log("addCliente: contacto("+contacto+") nombre("+nombre+")");
    
    if (!password) {
        res.status(400).send({response : "ERROR" , message: "Password no informada"});
        return;
    }
    if (!nombre) {
        res.status(400).send({response : "ERROR", message : "Nombre no informado"});
        return;
    }

    if (!contacto){
        res.status(400).send({response : "ERROR" , message : "Contacto no informado"});
        return;
    } 

    scanDb(contacto)
    .then(resultDb => {
      if (Object.keys(resultDb).length != 0) {
        res.status(400).send({response : "ERROR" , message : "Cliente ya existe"});
        return;
      } else {
        var hoy = new Date();
        var dd = String(hoy.getDate()).padStart(2, '0');
        var mm = String(hoy.getMonth() + 1).padStart(2, '0'); //January is 0!
        var yyyy = hoy.getFullYear();
        hoy = dd + '/' + mm + '/' + yyyy;
    
        const newCliente = {
         id                    : crypto.randomUUID(),
         contacto              : contacto,
         nombre                : nombre,
         password              : password,
         activo                : true,
         registrado            : true,
         primer_ingreso        : false,
         fecha_alta            : hoy,
         fecha_cambio_password : hoy,
         fecha_ultimo_ingreso  : hoy,
        };
    
        const paramsPut = {
          TableName: "cliente",
          Item: newCliente,
          ConditionExpression:'attribute_not_exists(id)',
        };

        docClient.put(paramsPut, function (err, data) {
            if (err) {
                res.status(400).send(JSON.stringify({response : "ERROR", message : "DB error" + err}));
            } else {
                const clienteSeguro = { ...newCliente };   // copia del objeto
                delete clienteSeguro.password;             // se quita la password de la copia
                res.status(200).send(JSON.stringify({response : "OK", "cliente": clienteSeguro}));
            }
        });
    }
    });

});
/*----------
/api/updateCliente
Permite actualizar datos del cliente contacto, nombre, estado de activo y registrado
*/
app.post('/api/updateCliente', (req,res) => {
    
    const {id} = req.body;
    const {nombre}   = req.body; 
    const {password} = req.body;

    var activo = ((req.body.activo+'').toLowerCase() === 'true')
    var registrado = ((req.body.registrado+'').toLowerCase() === 'true')

    console.log("updateCliente: id("+id+") nombre("+nombre+") activo("+activo+") registrado("+registrado+")");

    if (!id) {
        res.status(400).send({response : "ERROR" , message: "Id no informada"});
        return;
    }

    if (!nombre) {
        res.status(400).send({response : "ERROR" , message: "Nombre no informado"});
        return;
    }

    if (!password) {
        res.status(400).send({response : "ERROR" , message: "Password no informado"});
        return;
    }

    var params = {
        TableName: "cliente",
        Key: {
            "id" : id
            //test use "id": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"   
             }
        };
        
    docClient.get(params, function (err, data) {
        if (err)  {
            res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+ null}));
            return;
        } else {

            if (Object.keys(data).length == 0) {
                res.status(400).send(JSON.stringify({"response":"ERROR",message : "Cliente no existe"}),null,2);
                return;
            } else {

                const paramsUpdate = { 
   
                    ExpressionAttributeNames: { 
                         "#a": "activo", 
                         "#n": "nombre",
                         "#p": "password",
                         "#r": "registrado"

                    }, 
                    ExpressionAttributeValues: { 
                        ":a": activo , 
                        ":p": password,
                        ":n": nombre , 
                        ":r": registrado 
                   }, 
                   Key: { 
                       "id": id 
                   }, 
                   ReturnValues: "ALL_NEW", 
                   TableName: "cliente", 
                   UpdateExpression: "SET #n = :n, #p = :p, #a = :a, #r = :r" 
                };
                docClient.update(paramsUpdate, function (err, data) {
                    if (err)  {
                        res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+err}));
                        return;
                    } else {
                        delete data.Attributes.password;
                        res.status(200).send(JSON.stringify({response : "OK", message : "updated" , "data": data}));
                    }    
                });    
            }
        }    
    })


});
/*-------
/api/resetCliente
Permite cambiar la password de un cliente
*/
app.post('/api/resetCliente', async (req,res) => {

    const {id, contacto, password} = req.body;

    if (!id && !contacto) {
        res.status(400).send({response : "ERROR" , message: "Id o contacto no informado"});
        return;
    }

    if (!password) {
        res.status(400).send({response : "ERROR" , message: "Password no informada"});
        return;
    }

    try {
        /*---
          Ubica al cliente: por contacto (e-mail) si viene informado, o por id (modo original)
        */
        let cliente;
        if (contacto) {
            const items = await scanDbContacto(contacto);
            cliente = (items && items.length > 0) ? items[0] : undefined;
        } else {
            const resultado = await docClient.get({ TableName: "cliente", Key: { "id": id } }).promise();
            cliente = resultado.Item;
        }

        if (!cliente) {
            res.status(400).send(JSON.stringify({"response":"ERROR", message : "Cliente no existe"}));
            return;
        }

        /*---
          Actualiza la password y la fecha de cambio de password (formato dd/mm/aaaa)
        */
        var hoy = new Date();
        var dd = String(hoy.getDate()).padStart(2, '0');
        var mm = String(hoy.getMonth() + 1).padStart(2, '0');
        var yyyy = hoy.getFullYear();
        hoy = dd + '/' + mm + '/' + yyyy;

        const paramsUpdate = {
            TableName: "cliente",
            Key: { "id": cliente.id },
            ExpressionAttributeNames: { "#p": "password", "#f": "fecha_cambio_password" },
            ExpressionAttributeValues: { ":p": password, ":f": hoy },
            UpdateExpression: "SET #p = :p, #f = :f",
            ReturnValues: "ALL_NEW"
        };
        const data = await docClient.update(paramsUpdate).promise();

        delete data.Attributes.password;   // se quita la password antes de responder
        res.status(200).send(JSON.stringify({response : "OK", message : "updated" , "data": data}));

    } catch (err) {
        res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+err}));
    }
});
/*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*
/*                                                       API REST ticket                                                             *
/*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*/

/*---------
Función para realizar el SCAN de un DB de cliente usando contacto como clave para la búsqueda (no es clave formal del DB)
*/
async function scanDbTicket(clienteID) {
    var docClient = new AWS.DynamoDB.DocumentClient();
    const scanKey=clienteID;
    const paramsScan = { // ScanInput
      TableName: "ticket", // required
      Select: "ALL_ATTRIBUTES" || "ALL_PROJECTED_ATTRIBUTES" || "SPECIFIC_ATTRIBUTES" || "COUNT",
      FilterExpression : 'clienteID = :clienteID',
      ExpressionAttributeValues : {':clienteID' : scanKey}
    };      
    var objectPromise = await docClient.scan(paramsScan).promise().then((data) => {
          return data.Items 
    });  
    return objectPromise;
}
/*----------
  listarTicket
  API REST para obtener todos los tickets de un clienteID
*/  
app.post('/api/listarTicket', (req,res) => {

    const {ID}  = req.body;
    console.log("listarTicket: ID("+ID+")");
 
    if (!ID) {
        res.status(400).send({response : "ERROR" , message: "ID cliente  no informada"});
        return;
    }

    scanDbTicket(ID)
    .then(resultDb => {
      if (Object.keys(resultDb).length == 0) {
        res.status(400).send({response : "ERROR" , message : "clienteID no tiene tickets"});
        return;
      } else {
        res.status(200).send(JSON.stringify({response : "OK",  "data": resultDb}));
    }

    });

});

/*---------
  getTicket
  API REST para obtener los detalles de un ticket
*/
app.post('/api/getTicket', (req,res) => {
    const {id}  = req.body;
    console.log("getTicket: id("+id+")");
 
    if (!id) {
        res.status(400).send({response : "ERROR" , message: "ticket id no informada"});
        return;
    }
    var params = {
        TableName: "ticket",
        Key: {
            "id" : id
            //"clienteID": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"   
            //"id"       : "e08905a8-4aab-45bf-9948-4ba2b8602ced"
        }
    };
    docClient.get(params, function (err, data) {
        if (err) {
            res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+err}));
        }
        else {
            if (Object.keys(data).length == 0) {
                res.status(400).send({response : "ERROR" , message : "ticket invalido"});
            } else {
                res.status(200).send(JSON.stringify({response : "OK", "data" : data}));    
            }    
        }
    })
});

/*-----------------
/api/addTicket
API REST para agregar ticket (genera id)
*/
app.post('/api/addTicket', (req,res) => {

    const {clienteID} = req.body;
    const estado_solucion = 1;
    const {solucion} = req.body;
    const {descripcion} = req.body;

    var hoy = new Date();
    var dd = String(hoy.getDate()).padStart(2, '0');
    var mm = String(hoy.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = hoy.getFullYear();
    hoy = dd + '/' + mm + '/' + yyyy;

    const newTicket = {
     id                    : crypto.randomUUID(),
     clienteID             : clienteID,
     estado_solucion       : estado_solucion,
     solucion              : solucion,
     descripcion           : descripcion,
     fecha_apertura        : hoy,
     ultimo_contacto       : hoy
    };

    const paramsPut = {
      TableName: "ticket",
      Item: newTicket,
      ConditionExpression:'attribute_not_exists(id)',
    };

    docClient.put(paramsPut, function (err, data) {
        if (err) {
            res.status(400).send(JSON.stringify({response : "ERROR", message : "DB error" + err}));
        } else {
            res.status(200).send(JSON.stringify({response : "OK", "ticket": newTicket}));
        }
    });
}
)

/*--------
/api/updateTicket
Dado un id actualiza el ticket, debe informarse la totalidad del ticket excepto ultimo_contacto
*/
app.post('/api/updateTicket', (req,res) => {

    const {id} = req.body;
    const {clienteID} = req.body;
    const {estado_solucion} = req.body;
    const {solucion} = req.body;
    const {descripcion} = req.body;
    const {fecha_apertura} = req.body;

    if (!id) {
        res.status(400).send({response : "ERROR" , message: "Id no informada"});
        return;
    }

    if (!clienteID) {
        res.status(400).send({response : "ERROR" , message: "clienteID no informada"});
        return;
    }

    if (!estado_solucion) {
        res.status(400).send({response : "ERROR" , message: "estado_solucion no informada"});
        return;
    }

    if (!solucion) {
        res.status(400).send({response : "ERROR" , message: "solucion no informado"});
        return;
    }

    if (!fecha_apertura) {
        res.status(400).send({response : "ERROR" , message: "fecha apertura"});
        return;
    }
    
    var hoy = new Date();
    var dd = String(hoy.getDate()).padStart(2, '0');
    var mm = String(hoy.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = hoy.getFullYear();
    hoy = dd + '/' + mm + '/' + yyyy;

    const ultimo_contacto = hoy;

    var params = {
        TableName: "ticket",
        Key: {
            "id" : id
            //test use "id": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"   
             }
        };
        
    docClient.get(params, function (err, data) {
        if (err)  {
            res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+ null}));
            return;
        } else {

            if (Object.keys(data).length == 0) {
                res.status(400).send(JSON.stringify({"response":"ERROR",message : "ticket no existe"}),null,2);
                return;
            } else {

                const paramsUpdate = { 
   
                    ExpressionAttributeNames: { 
                         "#c": "clienteID", 
                         "#e": "estado_solucion",
                         "#s": "solucion",
                         "#a": "fecha_apertura",
                         "#u": "ultimo_contacto",
                         "#d": "descripcion"
                    }, 
                    ExpressionAttributeValues: { 
                        ":c":  clienteID, 
                        ":e":  estado_solucion , 
                        ":s":  solucion , 
                        ":a":  fecha_apertura,
                        ":u":  ultimo_contacto,
                        ":d":  descripcion 
                   }, 
                   Key: { 
                       "id": id 
                   }, 
                   ReturnValues: "ALL_NEW", 
                   TableName: "ticket", 
                   UpdateExpression: "SET #c = :c, #e = :e, #a = :a, #s = :s, #d = :d, #u = :u" 
                };
                docClient.update(paramsUpdate, function (err, data) {
                    if (err)  {
                        res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+err}));
                        return;
                    } else {
                        res.status(200).send(JSON.stringify({response : "OK",  "data": data}));
                    }    
                });    
            }
        }    
    })

});


/*---------
  resumenTickets
  API REST (sin GUI) accesible por GET o POST en la URL /resumenTickets
  Con un usuario y password válidos devuelve, para cada cliente de la base de datos, su id, su correo,
  la cantidad de tickets y, a continuación, la clave, fecha de apertura y estado de cada ticket.

  GET  .../resumenTickets?ID={usuario}&PASSWORD={password}
  POST .../resumenTickets  con el JSON {"ID":"{usuario}","PASSWORD":"{password}"}
  {usuario} puede ser el correo electrónico (contacto) o el id del cliente.
*/

/*---
  Lee usuario y password desde la URL (GET) o desde el cuerpo JSON (POST)
*/
function leerCredenciales(req) {
    const origen = (req.method == 'GET') ? req.query : (req.body || {});
    let usuario  = origen.ID;
    let password = origen.PASSWORD;

    // El enunciado escribe la URL como ?ID=x?PASSWORD=y, también se acepta ese formato
    if (typeof usuario == 'string' && usuario.includes('?PASSWORD=')) {
        const partes = usuario.split('?PASSWORD=');
        usuario  = partes[0];
        password = password || partes[1];
    }
    return { usuario, password };
}

/*---
  Valida usuario y password, devuelve el registro del cliente o null si no es válido
*/
async function validarUsuario(usuario, password) {
    let cliente;
    if (usuario.includes('@')) {
        const items = await scanDbContacto(usuario);
        cliente = (items && items.length > 0) ? items[0] : undefined;
    } else {
        const resultado = await docClient.get({ TableName: "cliente", Key: { "id": usuario } }).promise();
        cliente = resultado.Item;
    }
    if (!cliente) return null;
    if (cliente.password != password) return null;
    if (cliente.activo != true) return null;
    return cliente;
}

/*---
  Lee todos los registros de una tabla (recorre todas las páginas del scan)
*/
async function scanTabla(tabla) {
    let items = [];
    let params = { TableName: tabla };
    do {
        const data = await docClient.scan(params).promise();
        items = items.concat(data.Items);
        params.ExclusiveStartKey = data.LastEvaluatedKey;
    } while (params.ExclusiveStartKey);
    return items;
}

async function resumenTickets(req, res) {

    const { usuario, password } = leerCredenciales(req);
    console.log("resumenTickets: usuario(" + usuario + ")");

    if (!usuario || !password) {
        res.status(400).send({ response: "ERROR", message: "ID y PASSWORD son obligatorios" });
        return;
    }

    try {
        const valido = await validarUsuario(String(usuario), String(password));
        if (!valido) {
            res.status(400).send({ response: "invalido", message: "usuario o password incorrectos" });
            return;
        }

        const clientes = await scanTabla("cliente");
        const tickets  = await scanTabla("ticket");

        const resumen = clientes.map(c => {
            const susTickets = tickets.filter(t => t.clienteID == c.id);
            return {
                clienteID: c.id,
                contacto: c.contacto,
                cantidad_tickets: susTickets.length,
                tickets: susTickets.map(t => ({
                    id: t.id,
                    fecha_apertura: t.fecha_apertura,
                    estado: t.estado_solucion
                }))
            };
        });

        res.status(200).send(JSON.stringify({ response: "OK", resumen: resumen }));

    } catch (err) {
        res.status(400).send({ response: "ERROR", message: "DB access error " + err });
    }
}

app.get(['/resumenTickets', '/api/resumenTickets'], resumenTickets);
app.post(['/resumenTickets', '/api/resumenTickets'], resumenTickets);
/*-------------------------------------------------[ Fin del API REST ]-------------------------------------------------------------*/