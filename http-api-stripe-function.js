'use strict';
const Stripe = require('stripe');
const secret_key = process.env.secret_key;
const stripe = Stripe(`${secret_key}`);
const apiDrSimCreateOrden =process.env.apiDrSimCreateOrden;
var https = require('https');
const config = {
    headers: {
      DSIM_KEY: process.env.DSIM_KEY,
      DSIM_SECRET: process.env.DSIM_SECRET,
    },
};
exports.handler = async(event) => {
    let body;
    let statusCode = 200;
    const headers = {
        "Content-Type": "application/json",
    };
    try {
        switch (event.routeKey) {
            case "GET /checkout/{sessionId}":
                console.log('GET checkout');
                try {
                    const sessionId = event.pathParameters.sessionId;
                    var urlOrden = `https://0v8aexvf86.execute-api.us-east-1.amazonaws.com/tickets/ordenes/${sessionId}`;
                        
                    const optionsGetDyanamo = {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    };
                    
                    const reqDynamoGetOrden = await sendHttpRequest(urlOrden, optionsGetDyanamo);
                    const ticket = JSON.parse(reqDynamoGetOrden);
                    console.log(ticket);
                    const sessionDetails = await getStripeSessionDetails(ticket?.id_session);
                    console.log(sessionDetails);
                    if (ticket?.id && ticket?.id_ticket === 'none' && sessionDetails.payment_status === 'paid') {
                        console.log('El pago se ha concretado con éxito. Actualizando el estatus en la API de tickets...');
                        
                        const urlCreateTicket = `${apiDrSimCreateOrden}/${ticket.id_terminal}/${ticket.id_operador}/${ticket.imei}/${ticket.id_payment}`;
        
                        const optionsOrden = {
                            headers: config.headers,
                            method: 'POST',
                        };
                        
                        const reqDrSimCreateOrden = await sendHttpRequest(urlCreateTicket, optionsOrden);
                        const resDrSimCreateOrden = JSON.parse(reqDrSimCreateOrden);
                        console.log(resDrSimCreateOrden);
                        var nroTicket = 'none';
                        if (resDrSimCreateOrden?.res?.id_ticket){
                            nroTicket = resDrSimCreateOrden.res.id_ticket;
                            console.log(`ticket creado: ${nroTicket}`);
                        }

                        const reqTicket = {
                            id: ticket.id,
                            id_ticket: nroTicket,
                            date: ticket.date,
                            email: ticket.email,
                            imei: ticket.imei,
                            id_payment: ticket.id_payment,
                            price: ticket.price,
                            estatus: sessionDetails.payment_status,
                            id_session: ticket.id_session,
                            dataComplete: ticket.dataComplete + `, ticket: ${nroTicket}`,
                            id_terminal: ticket.id_terminal,
                            id_operador: ticket.id_operador,
                        };

                        const optionsPutDynamo = {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        };
                        urlOrden = `https://0v8aexvf86.execute-api.us-east-1.amazonaws.com/tickets/ordenes`;
                        const reqDynamoCreateOrden = await sendToDynamoBD(urlOrden, optionsPutDynamo, reqTicket);
                        console.log(reqDynamoCreateOrden);
                        
                        body = { message: 'Pago validado con éxito. Estatus actualizado a "paid".' };
                    } else {
                        console.log('Esta condicion no se cumplio: if (ticket.id && ticket.id_ticket === none && sessionDetails.payment_status === paid)');
                        body = { message: 'El pago no se ha concretado con éxito.' };
                    }
                } catch (error) {
                    console.error('Error al validar el pago:', error);
                    body = { message: 'Error al validar el pago.' };
                }

                break;
            
            case "POST /checkout":
                console.log('POST checkout');
                const { id, amount  } = JSON.parse(event.body);
                    try {
                    console.log(event.body);
                    const payment = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: "USD",
                    description: "Unlocked Phone",
                    payment_method: id,
                    confirm: true
                });
                console.log(payment);
                body = {message: 'Succesfull Payment'};
                } catch (error) {
                  console.error(error);
                  body = { message: 'Algo está mal en POST ckeckout', error };
                }
            
                break;
            
            case "POST /create-checkout-session":
                console.log('POST create-checkout-session');
                const { urlDomain, id_terminal, id_operador, id_service, imei, email  } = JSON.parse(event.body);
                
                try {
                    console.log(event.body);
                    var url = `https://api.doctorsim.com/tools/${id_terminal}/${id_operador}`;
        
                    const options = {
                        headers: config.headers,
                        method: 'GET',
                    };
                    const apiDrSimTools = await sendHttpRequest(url, options);
                    const response = JSON.parse(apiDrSimTools);
                    //console.log(response);
                    const tools = response.res.tools;
                    //console.log(tools);
                    
                    var tool;
                    for await (const item of tools){
                        if (item.id_tool === id_service){
                            tool = item;
                            break;
                        }
                    }
                    console.log(tool);
                    if (tool){
                        const producto = await stripe.products.create({
                            name: tool.name,
                            description: tool.service_name,
                        });
                        
                        console.log(producto);
                        
                        const precio = await stripe.prices.create({
                            product: producto.id,
                            unit_amount: parseInt(tool.price * 100),
                            currency: 'USD',
                        });
                        const timestamp = Date.now();
                        console.log(precio);
        
                        const session = await stripe.checkout.sessions.create({
                            line_items: [
                                {
                                price: precio.id,
                                quantity: 1,
                                },
                            ],
                            mode: 'payment',
                            success_url: `${urlDomain}/${timestamp}`,
                            cancel_url: `${urlDomain}/cancel`,
                        });
                        console.log(session);
                        /* valida si se conceto el pago exitosamente*/
                        //const sessionDetails = await getStripeSessionDetails(session.id);
                        //console.log('Detalles de la sesión:', sessionDetails);
                        /* fin de valida si se conceto el pago exitosamente*/
                        console.log(`Intento Para: ${email}/${id_terminal}/${id_operador}/${imei}/${id_service}`);
                        if (session.id) {
                           console.log(`Stripe a creado la sesion`);
                            
                            url = 'https://0v8aexvf86.execute-api.us-east-1.amazonaws.com/tickets/ordenes';
                            
                            const fecha = new Date(timestamp);
                            const hoy = fecha.toISOString();
                            const reqTicket = {
                                id: timestamp,
                                id_ticket: 'none',
                                date: hoy,
                                email: email,
                                imei: imei,
                                id_payment: id_service,
                                price: `${tool.price}`,
                                estatus: session.payment_status,
                                id_session: session.id,
                                dataComplete: `IMEI: ${imei}, idService/id_payment: ${id_service}, email: ${email}, price: ${tool.price}, date: ${hoy}`,
                                id_terminal: id_terminal,
                                id_operador: id_operador,
                                
                            };
                            const optionsDyanamo = {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                            };
                            console.log(reqTicket);
                            const reqDynamoCreateOrden = await  sendToDynamoBD(url, optionsDyanamo, reqTicket);
                            console.log(reqDynamoCreateOrden);
                            
                        }
                        
                        //res.redirect(303, session.url);
                        body = { sessionId: session.url };

                    }
                    else{
                        body = { sessionId: `${urlDomain}/cancel` };
                    }
                } catch (error) {
                  console.error(error);
                  body = { sessionId: `${urlDomain}/cancel` };
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
  //console.log(`Esto es la función sendHttpRequest con url: ${url} y el options ${options}`);
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      console.log(`statusCode ${url}: ${res.statusCode}`);
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

function sendToDynamoBD(apiUrl, options, requestData) {
return new Promise((resolve, reject) => {
    const req = https.request(apiUrl, options, (res) => {
      console.log(`statusCode ${apiUrl}: ${res.statusCode}`);
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          let dataErr = { statusCode: res.statusCode, message: 'Error en la solicitud' };
          reject(dataErr);
        }
      });
    });

    req.on("error", (e) => {
      reject(e);
    });

    // Enviar datos en el cuerpo de la solicitud
    if (requestData) {
      req.write(JSON.stringify(requestData));
    }

    req.end();
  });
}

// Función para obtener detalles de la sesión de Stripe
async function getStripeSessionDetails(sessionId) {
  const apiUrl = `https://api.stripe.com/v1/checkout/sessions/${sessionId}`;
  const options = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret_key}`,
    },
  };

  const sessionDetails = await sendHttpRequest(apiUrl, options);
  return JSON.parse(sessionDetails);
}