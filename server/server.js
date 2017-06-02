//Im thinking of using the packages mysql and mysql-events to alert teachers in real time
var express = require('express');
var mysql      = require('mysql');

const https = require('https');
const fs = require('fs');

const app = express();

//These allow for a https: url for connecting to APIs
const options = {
    key: fs.readFileSync( './ssl/key.pem' ),
    cert: fs.readFileSync( './ssl/cert.pem' ),
};

let connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'signSystem',
  password : 'masc1234',
  database : 'signSystem'
});

connection.connect();

//This sets what localhost port the server will run on
const port = 8083;

//This allows me to create a server that has ssl
/*const server = https.createServer(options, app).listen(port, function(){
    console.log("Express server listening on port " + port);
});*/


app.get("/test", (req, res) => {
    res.send('{"res": "Responding"}');
});

//Not complete. Might just use google sign in if I can get it to work
app.get("/addUser/:username/:hashedPassword/:userId", (req, res) => {
    const pass = req.params.hashedPassword;
    const user = req.params.username;

    const uuid = req.params.userId;

    connection.query('INSERT INTO users (userId, userName, hashedPass) VALUES (?, ?, ?)', [uuid, user, pass], (error, results, fields) => {
        if (error){
            res.send("error");
            throw error
        }
        console.log('Insert in to users result: ',results);
    })
});

//Checks signOut conditions then changes user state to out and pass state to out
app.get('/signOut/:userId/:roomId', async function(req, res) {
    const user = req.params.userId;
    const room = req.params.roomId;

    function createResponse(error, message, success){
        const res = {
            success: success,
            message: message,
            error: error,
        }
        return res;
    }

    async function checkUser(){
        return new Promise((resolve, reject) => {
          connection.query('SELECT * FROM users WHERE userId = ?', [user], (error, results) => {
            if (error) throw error;
            if(results.length < 1){
              resolve("Invalid User Id");
              console.log("Rejecting for too few results");
            }else if(results.length > 1){
              console.log("Warning, more than one user for Id");
            }else if(results[0].userState === "true"){
                resolve("User already out");
            }else{
                resolve(true);
            }
          });
        })
    }

    function checkRoom(){
        return new Promise((resolve, reject) => {
            connection.query('SELECT * FROM passes WHERE roomId = ?', [room], (error, results) => {
                if(error) throw error;
                if(results.length < 1){
                    resolve("Invalid Room Id");
                }else if(results.length > 1){
                    console.log("Warning, more than one room shares this Id. How did that even happen?");
                }else if(results[0].passState === 'true'){
                    resolve("Pass already in use");
                }else{
                    resolve(true);
                }
            })
        })
    }

    async function check(){
        try{
            const user = await checkUser();
            const room = await checkRoom();
          if(user == true && room == true){
            return true;
          }else{
            return user+" and "+room;
          }
        }catch(err){
            return false;
        }
    }

    async function signOut(){
        connection.query('UPDATE passes SET passState = "true", currentUser = ? WHERE roomId = ?', [user, room], (error, results) => {
          if(error) throw error;
          connection.query('UPDATE users SET userState = "true" WHERE userId = ?', [user], (error, results) => {
              if(error) throw error;
              return true;
          })
        })
    }

    try {
      let valid = await check();
      if(valid == true){
        await signOut();
        await logUserSignOut(user, room);
        res.send(createResponse(null, "User signed out", true))
      }else{
          res.send(createResponse(valid, null, false))
      }
    }catch(err){
        res.send(createResponse(err, null, false))
    }
});

//Check signIn conditions then changes user state to in and pass state to in
app.get('/signIn/:userId/:roomId', async function(req, res) {
  const user = req.params.userId;
  const room = req.params.roomId;

  function createResponse(error, message, success){
    return res = {
      success: success,
      message: message,
      error: error,
    }
  }

  async function checkUser(){
    return new Promise((resolve, reject) => {
      connection.query('SELECT * FROM users WHERE userId = ?', [user], (error, results) => {
        if (error) throw error;
        if(results.length < 1){
            resolve("Invalid User Id")
        }else if(results.length > 1){
            console.log("Warning, more than one user for Id")
        }else if(results[0].userState === "true"){
          resolve(true);
        }else{
          resolve("User not signed out");
        }
      });
    })
  }

  function checkRoom(){
    return new Promise((resolve, reject) => {
      connection.query('SELECT * FROM passes WHERE roomId = ?', [room], (error, results) => {
        if(error) throw error;
        if(results.length < 1){
            resolve("Invalid Room Id");
        }else if(results.length > 1){
          console.log("Warning, more than one room shares this Id. How did that even happen?");
        }else if(results[0].passState === 'true' && results[0].currentUser === user){
          resolve(true);
        }else if(results[0].passState === 'false'){
          resolve("Pass is not signed out");
        }else{
          resolve("User is signing into the wrong room");
        }
      })
    })
  }

  async function check(){
    try{
      const user = await checkUser();
      const room = await checkRoom();
      if(user == true && room == true){
          return true;
      }else{
          return user+" and "+room;
      }
    }catch(err){
      return false;
    }
  }

  async function signIn(){
    connection.query('UPDATE passes SET passState = "false", currentUser = "null" WHERE roomId = ?', [room], (error, results) => {
      if(error) throw error;
      connection.query('UPDATE users SET userState = "false" WHERE userId = ?', [user], (error, results) => {
        if(error) throw error;
        console.log("Signed In");
        return true;
      })
    })
  }

  try {
    let valid = await check();
    if(valid == true){
      await signIn();
      await logUserSignIn(user, room);
      res.send(createResponse(null, "User signed In", true))
    }else{
      res.send(createResponse(valid, null, false))
    }
  }catch(err){
    res.send(createResponse(err, null, false))
  }
});

async function logUserSignOut(userId, roomId){
  const currentTime = Math.floor((new Date()).getTime()/1000);

  connection.query('INSERT INTO userTimes (userId, roomId, timeOut) VALUES (?, ?, ?)', [userId, roomId, currentTime], (error, results) => {
    if (error){
      console.log("LogUserSignOutError: "+error);
      return false;
    }
    return true;
  })
}

async function logUserSignIn(userId, roomId){
  const currentTime = Math.floor((new Date()).getTime()/1000);

  connection.query('UPDATE userTimes SET timeIn = ? WHERE (userId=? AND roomId = ? AND timeIn = 0)', [currentTime, userId, roomId], (error, results) => {
    if (error){
      console.log("LogUserSignOutError: "+error);
      return false;
    }
    return true;
  })
}

setInterval(testUsersOutTime, 10000);

function testUsersOutTime(){
  const now = (new Date).getTime();

  connection.query('SELECT timeOut FROM userTimes WHERE timeIn = 0', (error, results) => {
    if(error) throw error;
    console.log("Results: "+JSON.stringify(results));
    results.forEach((res) => {
      const timeOut = res.timeout*1000;
      if(now - timeOut > 1000*60*5){
        console.log("Out for more than 5 minutes");
      }else{
        console.log("Still fine");
      }
    });
  })
}

app.listen(port);

process.stdin.resume();

process.on('SIGTERM', killProcess);
process.on('SIGINT', killProcess);

function killProcess(){
    connection.end();
    app.close();
    console.log("Process Exiting");
    process.exit();
}
