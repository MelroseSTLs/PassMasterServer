//Im thinking of using the packages mysql and mysql-events to alert teachers in real time
const express = require('express');
const https = require('https');

const app = express();

import * as urls from './urls';
import * as database from './database';
import * as options from './options';

//This allows me to create a server that has ssl
/*const server = https.createServer(options, app).listen(options.PORT, function(){
    console.log("Express server listening on port " + options.PORT);
});*/


app.get("/test", (req, res) => {
    res.send('{"res": "Responding"}');
});

app.get(urls.userState, async function(req, res){
  const result = await database.getUserState(req.params.userId);
  res.send(result);
});

//Checks signOut conditions then changes user state to out and pass state to out
app.get(urls.signOut, async function(req, res) {
  const result = await database.signOut(req.params.userId, req.params.roomId);
  res.send(result);
});

//Check signIn conditions then changes user state to in and pass state to in
app.get(urls.signIn, async function(req, res) {
  const result = await database.signIn(req.params.userId, req.params.roomId);
  res.send(result);
});

//This gets passes for today
app.get(urls.userActivityToday, async function(req, res) {
  const result = await database.getTodayUserActivity(req.params.userId);
  res.send(result);
});
app.get(urls.passActivityToday, async function(req, res) {
  const result = await database.getTodayPassActivity(req.params.passId);
  res.send(result);
});

//This one is more general, get activity for a certain date.
app.get(urls.userActivityDate, async function(req, res) {
  const day = parseInt(req.params.day);
  const month = parseInt(req.params.month) - 1;
  let year = parseInt(req.params.year);
  const id = req.params.userId;

  const result = await database.getDateUserActivity(day, month, year, id);
  res.send(result);
});
app.get(urls.passActivityDate, async function(req, res) {
  const day = parseInt(req.params.day);
  const month = parseInt(req.params.month) - 1;
  let year = parseInt(req.params.year);
  const id = req.params.passId;

  const result = await database.getDatePassActivity(day, month, year, id);
  res.send(result);
});

const server = app.listen(options.PORT, () => {
  const { address, port } = server.address();
  console.log(`Listening at http://${address}:${port}`);
});

process.stdin.resume();

process.on('SIGTERM', killProcess);
process.on('SIGINT', killProcess);

function killProcess(){
    //connection.end();
    app.close();
    console.log("Process Exiting");
    process.exit();
}
