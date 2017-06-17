import fs from 'fs'

export const PORT = 8084;

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

export const SSL_OPTIONS = {
  key: fs.readFileSync( 'server/ssl/key.pem' ),
  cert: fs.readFileSync( 'server/ssl/cert.pem' ),
};

