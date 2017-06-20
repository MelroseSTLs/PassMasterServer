import fs from 'fs'

export const PORT = 3000;

export const DEFAULT_TIME = 1;

//Stored In Milliseconds
export const MAX_TIMEOUT = 5*60*1000;
export const TIMEOUT_CHECK_INTERVAL = 1000*60;

export const DATABASE_OPTIONS = {
  host     : 'localhost',
  user     : 'signSystem',
  password : 'masc1234',
  database : 'signSystem'
};

/*export const SSL_OPTIONS = {
  key: fs.readFileSync( 'server/ssl/key.pem' ),
  cert: fs.readFileSync( 'server/ssl/cert.pem' ),
};*/

export const google = {
  clientID: '256030481662-me9i9pn0ltgnu7ms10783ab3he3jo1ho.apps.googleusercontent.com',
  clientSecret: 'Y4TQ3r6Kgf3dyuR-VZmlmE9z',
  callbackURL: 'http://localhost:'+PORT+'/auth/google/callback',
};

