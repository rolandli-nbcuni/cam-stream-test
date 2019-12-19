const express = require('express');
const app = express()
const path = require('path')
const port = 3002;
const WebSocket = require('ws');
var fs = require('fs');
const https = require('https')

const WS_PORT = process.env.WS_PORT || 3003;

const cors = require('cors');
const bodyParser = require('body-parser');
const bluetooth = require('node-bluetooth');
const device = new bluetooth.DeviceINQ();

var privateKey = fs.readFileSync('./server.key', 'utf8');
var certificate = fs.readFileSync('./server.cert', 'utf8');
var credentials = { key: privateKey, cert: certificate };

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(express.static(path.join(__dirname + '/../build/')));
app.get('/viewer/:userId', (req, res) => res.sendFile(path.join(__dirname + '/../build/index2.html')));
app.get('/streamer/:userId', (req, res) => res.sendFile(path.join(__dirname + '/../build/')));

app.post('/getbluetooth', (req, res) => {
  let query = req.body;
  res.setHeader('Content-Type', 'application/json');
  device.listPairedDevices(console.log);
  res.send([{ "tuna": "tuna" }]);

});

//hot loader
function startServer() {
  return new Promise((resolve, reject) => {
    const httpServer = https.createServer({
      key: privateKey,
      cert: certificate
    }, app).listen(port, () => console.log(`Example app listening on port ${port}!`))
    httpServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(err);
      }
    });

    httpServer.once('listening', () => resolve(httpServer));
  }).then(httpServer => {
    const { port } = httpServer.address();
    console.info(`==> 🌎 Listening on ${port}. Open up http://localhost:${port}/ in your browser.`);
    //web socket server
    const wssServer = new WebSocket.Server({ server: httpServer }, () => console.log(`WS server is listening at wss://localhost:${port}`));
    // array of connected websocket clients
    let connectedClients = [];
    let broadcasters = [];
    let broadcasterClients = [];
    let viewerClients = [];
    let viewers = [];
    wssServer.on('connection', (ws, req) => {
      console.log('Connected');
      // add new connected client
      connectedClients.push(ws);
      // listen for messages from the streamer, the clients will not send anything so we don't need to filter
      ws.on('message', data => {
        // send the base64 encoded frame to each connected ws

          data = JSON.parse(data);
          if (data.action == "init viewer"){
            updateBroadcasterList();
            ws.viewerId = data.viewerId;
            ws.type="viewer";
            viewerClients.push(ws);
          }
          if (data.action == "start") {
            ws.userId = data.userId;

            ws.type = "broadcaster";
            // ws.offerType =  data.type;
            ws.viewers = [];
            ws.description = data.description;
            if(broadcasterClients.filter(client => (client.userId ===data.userId)).length === 0){
              broadcasterClients.push(ws)
            }
            if (broadcasters.indexOf(data.userId) == -1) {
              broadcasters.push(data.userId);
            }
            updateBroadcasterList();

          }
          // if(data.action == "broadcasting"){
          //   broadcasterClients.forEach(client=>{
          //     if(client.userId === ws.userId){
          //       console.log(data.videoData);
          //       client.streamData = data.videoData;
          //     }
          //   });
          // }
          if(data.action == "add viewer"){
            console.log('add viewer');
            broadcasterClients.forEach((client, i) => {
              if(data.streamerId === client.userId && client.viewers.indexOf(data.viewerId) === -1){
                console.log('make pc');
                client.send(
                  JSON.stringify({
                    action: "make pc",
                    viewerId: ws.viewerId,
                  })
                );
              }
            })
          }
          if(data.action == "send description to viewer"){
            viewerClients.forEach((client)=>{
              if(client.viewerId == data.viewerId){
                client.send(JSON.stringify({
                  action: "send broadcast",                  
                  target: data.streamerId,
                  returnedDescription: data.description
                }));
              }
            });

          }
          if (data.action == "stop") {
            console.log("stop");
            broadcasters = broadcasters.filter(id => id !== data.userId);
            updateBroadcasterList();
            broadcasterClients.forEach((client, i) => {
              if(ws.userId === client.userId){
                broadcasterClients.splice(i, 1)
              }
            })
          }
          // if(data.action == "send description") {
          //   let returnedDescription;
          //   console.log("request stream");
          //   console.log(data.streamerId);
          //   console.log(broadcasterClients);
          //   broadcasterClients.forEach((client, i) => {
          //     console.log(client.userId);
          //     if(client.userId == data.streamerId){
          //       returnedDescription = client.description;
          //     }
          //   }); 

          //   ws.send(JSON.stringify({
          //         action: "send broadcast",
          //         target: data.streamerId,
          //         returnedDescription
          //   }));
          // }
          if(data.action == "send answer"){
            broadcasterClients.forEach((client, i) => {
              if(client.userId == data.target){
                client.viewers.push(data.viewerId);
                client.send(JSON.stringify({
                  action: "recieved answer",
                  viewerId: data.viewerId,
                  description: data.description
                })
                )
              }
            });
          }
          if(data.action == "new-ice-candidate"){
            if(data.type =="broadcaster"){
              viewerClients.forEach((client, i )=> {
                if(client.viewerId == data.target){
                  console.log("broadcaster ice");
                  client.send(JSON.stringify({
                    action: "new-ice-candidate",
                    target: data.target,
                    candidate: data.candidate
                  })
                  )
                }
              });
            }
            if(data.type =="viewer"){
              broadcasterClients.forEach((client, i )=> {
                if(client.userId == data.target){
                  console.log("client ice");
                  client.send(JSON.stringify({
                    action: "new-ice-candidate",
                    target: data.target,
                    viewerId: data.viewerId,
                    candidate: data.candidate
                  })
                  )
                }
              });
            }
          }
          if(data.action=="remove viewer"){
            console.log(
              "remove viewer"
            )
            broadcasterClients.forEach((client, i) => {
              if(client.viewers.indexOf(ws.viewerId ) !== -1){
                client.viewers.splice(client.viewers.indexOf(ws.viewerId ), 1);
              }
            });
          }
        

        connectedClients.forEach((ws, i) => {
          if (ws.readyState === ws.OPEN) { // check if it is still connected
            //  ws.send(data); // send
          } else { // if it's not connected remove from the array of connected ws
            connectedClients.splice(i, 1);
          }
        });
      });
      ws.on('close',
        ()=>{
          console.log("close");

          if(ws.type === "broadcaster"){
            broadcasters = broadcasters.filter(id => id !== ws.userId);

            broadcasterClients.forEach((client, i) => {
              if(ws.userId === client.userId){
                broadcasterClients.splice(i, 1)
              }
            })
            updateBroadcasterList();

          }
          if(ws.type === "viewer"){
            broadcasterClients.forEach((client, i) => {
              if(client.viewers.indexOf(ws.viewerId ) !== -1){
                client.viewers.splice(client.viewers.indexOf(ws.viewerId ), 1);
              }
            })
            
            viewerClients.forEach((client, i )=>{
              if(ws.viewerId === client.viewerId){
                viewerClients.splice(i, 1)
              }
            })
          }
          console.log(broadcasterClients.length);
        }
      );

    });
    // Hot Module Replacement API
    if (module.hot) {
      let currentApp = app;
      module.hot.accept('./express', () => {
        httpServer.removeListener('./express', currentApp);
        import('./express')
          .then(({ default: nextApp }) => {
            currentApp = nextApp;
            httpServer.on('request', currentApp);
            console.log('HttpServer reloaded!');
          })
          .catch(err => console.error(err));
      });

      // For reload main module (self). It will be restart http-server.
      module.hot.accept(err => console.error(err));
      module.hot.dispose(() => {
        console.log('Disposing entry module...');
        httpServer.close();
      });
    }

    let updateBroadcasterList = ()=>{
      connectedClients.forEach((ws, i) => {
        if (ws.readyState === ws.OPEN) { // check if it is still connected
          ws.send(JSON.stringify({
            action: "recieved broadcasters",
            broadcasters
          }));
          
        }
      });
    }
  });
}

console.log('Starting http server...');
startServer().catch(err => {
  console.error('Error in server start script.', err);
});

