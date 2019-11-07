const express = require('express')
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
var privateKey  = fs.readFileSync('./server.key', 'utf8');
var certificate = fs.readFileSync('./server.cert', 'utf8');
var credentials = {key: privateKey, cert: certificate};

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(express.static(path.join(__dirname+'/../build/')));
app.get('/viewer/:userId', (req, res) => res.sendFile(path.join(__dirname+'/../build/index2.html')));
app.get('/streamer/:userId', (req, res) => res.sendFile(path.join(__dirname+'/../build/')));

app.post('/getbluetooth',(req,res)=>{
  let query = req.body;
  res.setHeader('Content-Type', 'application/json');
  device.listPairedDevices(console.log);
  res.send([{"tuna": "tuna"}]);
  
});

//web socket server
const wsServer = new WebSocket.Server({ port: WS_PORT }, () => console.log(`WS server is listening at ws://localhost:${WS_PORT}`));
// array of connected websocket clients
let connectedClients = [];

wsServer.on('connection', (ws, req) => {
    console.log('Connected');
    // add new connected client
    connectedClients.push(ws);
    // listen for messages from the streamer, the clients will not send anything so we don't need to filter
    ws.on('message', data => {
        // send the base64 encoded frame to each connected ws
        connectedClients.forEach((ws, i) => {
            if (ws.readyState === ws.OPEN) { // check if it is still connected
                ws.send(data); // send
            } else { // if it's not connected remove from the array of connected ws
                connectedClients.splice(i, 1);
            }
        });
    });
});


//hot loader
function startServer() {
  return new Promise((resolve, reject) => {
    const httpServer = https.createServer({
      key: privateKey, 
      cert: certificate
    } , app).listen(port, () => console.log(`Example app listening on port ${port}!`))
 
    httpServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(err);
      }
    });
 
    httpServer.once('listening', () => resolve(httpServer));
  }).then(httpServer => {
    const { port } = httpServer.address();
    console.info(`==> 🌎 Listening on ${port}. Open up http://localhost:${port}/ in your browser.`);
 
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
  });
}
 
console.log('Starting http server...');
startServer().catch(err => {
  console.error('Error in server start script.', err);
});

