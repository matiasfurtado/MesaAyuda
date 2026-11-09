import express from 'express';
//var express = require('express');
var app = express();
var PORT=8080;

console.log('Express Ok! Listen('+PORT+')');
app.get('/getTicket', function (req, res) {
  res.send('el ticket es: 123456');
});

app.listen(8080, function () {
  console.log('Example app listening on port:'+PORT);
});

