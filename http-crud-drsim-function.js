'use strict';
var https = require('https');
var apiDrSimTools = process.env.apiDrSimTools;
var apiDrSimCreateOrden =process.env.apiDrSimCreateOrden;

exports.handler = async (event) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
  };

  const config = {
    headers: {
      DSIM_KEY: process.env.DSIM_KEY,
      DSIM_SECRET: process.env.DSIM_SECRET,
    },
  };

  try {
    switch (event.routeKey) {
      case "GET /tools/{idTerminal}/{idOperador}":
        console.log('GET tools');
        var idTerminal = event.pathParameters.idTerminal;
        var idOperador = event.pathParameters.idOperador;
        var url = `${apiDrSimTools}/${idTerminal}/${idOperador}`;
        try {
          const options = {
            headers: config.headers,
            method: 'GET',
          };
          const response = await sendHttpRequest(url, options);
          body = JSON.parse(response);
        } catch (error) {
          console.error(error);
          body = { message: 'Algo está mal en GET tools/', error };
        }

        break;
      case "POST /create_order/{idTerminal}/{idOperador}/{imei}/{idServicio}":
        console.log('POST create_order');
        var idTerminal = event.pathParameters.idTerminal;
        var idOperador = event.pathParameters.idOperador;
        var imei = event.pathParameters.imei;
        var idServicio = event.pathParameters.idServicio;
        var url = `${apiDrSimCreateOrden}/${idTerminal}/${idOperador}/${imei}/${idServicio}`;
        console.log( `${apiDrSimCreateOrden}/${idTerminal}/${idOperador}/${imei}/${idServicio}`);
        try {
          const options = {
            headers: config.headers,
            method: 'POST',
          };
          const response = await sendHttpRequest(url, options);
          body = JSON.parse(response);
        } catch (error) {
          console.error(error);
          body = { message: 'Algo está mal en POST create_order/', error };
        }
        
        break;

      default:
        throw new Error(`Unsupported route: "${event.routeKey}"`);
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};


function sendHttpRequest(url, options) {
  console.log(`Esto es la función sendHttpRequest con url: ${url} y el options ${JSON.stringify(options)}`);
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      console.log(`statusCode: ${res.statusCode}`);
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          let dataErr = { statusCode: res.statusCode, message: 'Error en la solicitud' };
          resolve(JSON.stringify(dataErr));
        }
      });
    });
    req.on("error", (e) => {
      reject(e);
    });
    req.end();
  });
}