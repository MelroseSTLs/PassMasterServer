const mysql = require('mysql');
import rp from 'request-promise';

import * as options from './config';

let connection = mysql.createConnection(options.DATABASE_OPTIONS);

connection.connect();

export async function getUserState(user){
  function createRes(success, res){
    return {
      success: success,
      res: res,
    }
  }

  return new Promise((resolve, reject) => {
    connection.query('SELECT * FROM users WHERE userId = ?', [user], (error, results) => {
      if (error) {
        resolve (createRes(false, null))
      } else {
        if (results.length > 1) {
          console.log("Warning, more than one user for id: " + user);
        }
        resolve(createRes(true, results[0].userState));
      }
    })
  })
}

export async function signOut(user, room){
  function createResponse(error, message, success){
    return {
      success: success,
      message: message,
      error: error
    };
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

  async function signOutPass(){
    return new Promise((resolve, reject) => {
      connection.query('UPDATE passes SET passState = "true", currentUser = ? WHERE roomId = ?', [user, room], (error, results) => {
        if (error) throw error;
        connection.query('UPDATE users SET userState = "true" WHERE userId = ?', [user], (error, results) => {
          if (error) throw error;
          resolve(true);
        })
      })
    })
  }

  async function logUserSignOut(userId, roomId){
    const currentTime = Math.floor((new Date()).getTime()/1000);
    rp({url: "https://mhs-aspencheck-serve.herokuapp.com/", timeout: 2000})
      .then((aspen) => {
        aspen = JSON.parse(aspen);
        console.log(aspen.schedule.block);
        connection.query('INSERT INTO userTimes (userId, roomId, timeOut, block) VALUES (?, ?, ?, ?)', [userId, roomId, currentTime, aspen.schedule.block], (error, results) => {
          if (error){
            console.log("LogUserSignOutError: "+error);
            return false;
          }
          console.log("Inserted");
          return true;
        })
      })
      .catch((err) => {
        console.log("Schedule Check Did Not Respond");
        connection.query('INSERT INTO userTimes (userId, roomId, timeOut, block) VALUES (?, ?, ?, ?)', [userId, roomId, currentTime, "Z"], (error, results) => {
          if (error){
            console.log("LogUserSignOutError: "+error);
            return false;
          }
          console.log("Inserted");
          return true;
        })
      })
  }

  async function setTimeoutCounter(){
    setTimeout(testUsersOutTime, options.MAX_TIMEOUT);
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

  try {
    let valid = await check();
    if(valid == true){
      await signOutPass();
      await logUserSignOut(user, room);
      setTimeoutCounter();
      return createResponse(null, "User signed out", true)
    }else{
      return (createResponse(valid, null, false))
    }
  }catch(err){
    return (createResponse(err, null, false))
  }
}

export async function signIn(user, room){
  function createResponse(error, message, success){
    return{
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

  async function signInPass(){
    return new Promise((resolve, reject) => {
      connection.query('UPDATE passes SET passState = "false", currentUser = "null" WHERE roomId = ?', [room], (error, results) => {
        if (error) throw error;
        connection.query('UPDATE users SET userState = "false" WHERE userId = ?', [user], (error, results) => {
          if (error) throw error;
          console.log("Signed In");
          resolve(true);
        })
      })
    })
  }

  async function logUserSignIn(userId, roomId){
    const currentTime = Math.floor((new Date()).getTime()/1000);
    return new Promise((resolve, reject) => {
      connection.query('UPDATE userTimes SET timeIn = ? WHERE (userId=? AND roomId = ? AND timeIn = 0)', [currentTime, userId, roomId], (error, results) => {
        if (error) {
          console.log("LogUserSignOutError: " + error);
          resolve(false);
        }
        resolve(true);
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

  try {
    let valid = await check();
    if(valid == true){
      await signInPass();
      await logUserSignIn(user, room);
      return(createResponse(null, "User signed In", true))
    }else{
      return(createResponse(valid, null, false))
    }
  }catch(err){
    return(createResponse(err, null, false))
  }
}

export async function getTodayUserActivity(id){
  const createRes = (boolSuccess, message) => {
    console.log("Response: "+JSON.stringify({
        success: boolSuccess,
        results: message
      }));
    return{
      success: boolSuccess,
      results: message
    }
  }

  async function getInfo(userId){
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 59, 59, 0);

    console.log("Searching between "+start.getTime()/1000+" and "+end.getTime()/1000+" for user "+userId + " for date "+start.getDate());

    return new Promise((resolve, reject) => {
      connection.query('SELECT * FROM userTimes WHERE timeOut BETWEEN ? AND ? AND userId = ?', [start.getTime()/1000, end.getTime()/1000, userId], (error, results, fields) => {
        if(error){
          resolve(false);
        }else{
          console.log("Resolving: "+results);
          resolve(results);
        }
      })
    })
  }

  const info = await getInfo(id);
  console.log("Info: "+info);
  if(info === false){
    return(createRes(false, "Failed to access database"));
  }else{
    info.forEach((row) => {
      row.timeIn = row.timeIn*1000;
      row.timeOut = row.timeOut*1000;
      if(parseInt(row.timeIn) > 1) {
        row.totalOutTime = (parseInt(row.timeIn) - parseInt(row.timeOut));
      }else{
        row.totalOutTime = 1;
      }
    });
    return(createRes(true, info));
  }
}

export async function getTodayPassActivity(id){
  const createRes = (boolSuccess, message) => {
    return({
      success: boolSuccess,
      results: message
    })
  }

  async function getInfo(passId){
    let start = new Date();
    start.setHours(1, 0, 0, 0)
    let end = new Date();
    end.setHours(23, 0, 0, 0)

    return new Promise((resolve, reject) => {
      connection.query('SELECT * FROM userTimes WHERE timeOut BETWEEN ? AND ? AND roomId = ?', [start.getTime()/1000, end.getTime()/1000, passId], (error, results, fields) => {
        if(error){
          resolve(false);
        }else{
          resolve(results);
        }
      })
    })
  }

  const info = await getInfo(id);
  if(info === false){
    return(createRes(false, "Failed to access database"));
  }else{
    info.forEach((row) => {
      row.timeIn = row.timeIn*1000;
      row.timeOut = row.timeOut*1000;
      if(parseInt(row.timeIn) > 1) {
        row.totalOutTime = (parseInt(row.timeIn) - parseInt(row.timeOut));
      }else{
        row.totalOutTime = 1;
      }
    })
    return(createRes(true, info));
  }
}

export async function getDateUserActivity(day, month, year, id){
  const createRes = (boolSuccess, message) => {
    return({
      success: boolSuccess,
      results: message
    })
  }

  async function getInfo(userId){
    let start = new Date();
    start.setHours(1, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 0, 0, 0);
    if(!isNaN(day)){
      start.setDate(day);
      end.setDate(day);
    }
    if(!isNaN(month)){
      start.setMonth(month);
      end.setMonth(month);
    }
    if(!isNaN(year)) {
      if(year < 2000){
        year += 2000;
      }
      start.setYear(year);
      end.setYear(year);
    }

    return new Promise((resolve, reject) => {
      connection.query('SELECT * FROM userTimes WHERE timeOut BETWEEN ? AND ? AND userId = ?', [start.getTime()/1000, end.getTime()/1000, userId], (error, results, fields) => {
        if(error){
          resolve(false);
        }else{
          resolve(results);
        }
      })
    })
  }

  const info = await getInfo(id);
  if(info === false){
    return(createRes(false, "Failed to access database"));
  }else{
    info.forEach((row) => {
      row.timeIn = row.timeIn*1000;
      row.timeOut = row.timeOut*1000;
      if(parseInt(row.timeIn) > 1) {
        row.totalOutTime = (parseInt(row.timeIn) - parseInt(row.timeOut));
      }else{
        row.totalOutTime = 1;
      }
    });
    return(createRes(true, info));
  }
}

export async function getDatePassActivity(day, month, year, id){
  const createRes = (boolSuccess, message) => {
    return({
      success: boolSuccess,
      results: message
    })
  }

  async function getInfo(passId){
    let start = new Date();
    start.setHours(1, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 0, 0, 0);
    if(!isNaN(day)){
      start.setDate(day);
      end.setDate(day);
    }
    if(!isNaN(month)){
      start.setMonth(month);
      end.setMonth(month);
    }
    if(!isNaN(year)) {
      if(year < 2000){
        year += 2000;
      }
      start.setYear(year);
      end.setYear(year);
    }

    return new Promise((resolve, reject) => {
      connection.query('SELECT * FROM userTimes WHERE timeOut BETWEEN ? AND ? AND roomId = ?', [start.getTime()/1000, end.getTime()/1000, passId], (error, results, fields) => {
        if(error){
          resolve(false);
        }else{
          resolve(results);
        }
      })
    })
  }

  const info = await getInfo(id);
  if(info === false){
    return(createRes(false, "Failed to access database"));
  }else{
    info.forEach((row) => {
      row.timeIn = row.timeIn*1000;
      row.timeOut = row.timeOut*1000;
      if(parseInt(row.timeIn) > 1) {
        row.totalOutTime = (parseInt(row.timeIn) - parseInt(row.timeOut));
      }else{
        row.totalOutTime = 1;
      }
    });
    return(createRes(true, info));
  }
}

export async function handleSignIn(id, name){
  const createRes = (booleanSuccess, message) => {
    return {
      success: booleanSuccess,
      results: message
    }
  };

  //resolve true means user was added, false means user already existed
  async function testAndAdd(userId, userName){
    return new Promise((resolve, reject) => {
      connection.query("SELECT userName FROM users WHERE userId=?", [id], (error, results, fields) => {
        if(error){
          reject(err);
        }else if(results.length > 0){
          resolve(false);
        }else{
          connection.query("INSERT INTO users (userId, userName, userState) VALUES (?, ?, 'false')", [userId, userName], (error, results, fields) => {
            if(error){
              resolve(err);
            }else{
              resolve(true);
            }
          })
        }
      })
    })
  }

  const addResponse = await testAndAdd(id, name);
  if(addResponse == true){
    return createRes(true, "New user added");
  }else if(addResponse == false){
    return createRes(true, "User exists");
  }else{
    return createRes(false, addResponse);
  }
}


function testUsersOutTime(){
  function logNoUserSignIn(userId, roomId){
    connection.query('UPDATE userTimes SET timeIn = ? WHERE (userId=? AND roomId = ? AND timeIn = 0)', [options.DEFAULT_TIME, userId, roomId], (error, results) => {
      if (error) throw error;
      connection.query('UPDATE passes SET passState = "false", currentUser = "null" WHERE roomId = ?', [roomId], (error, results) => {
        if(error) throw error;
        connection.query('UPDATE users SET userState = "false" WHERE userId = ?', [userId], (error, results) => {
          if(error) throw error;
          console.log("User: "+userId+", Room: "+roomId);
          return true;
        })
      })
    })
  }

  const now = (new Date).getTime();

  connection.query('SELECT * FROM userTimes WHERE timeIn = 0', (error, results) => {
    if(error) throw error;
    results.forEach((res) => {
      const timeOut = res.timeOut*1000;
      if(now - timeOut > options.MAX_TIMEOUT){
        const room = res.roomId;
        const user = res.userId;
        logNoUserSignIn(user, room);
      }
    });
  })
}
setInterval(testUsersOutTime, options.TIMEOUT_CHECK_INTERVAL);