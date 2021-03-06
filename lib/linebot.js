'use strict';

const EventEmitter = require('events');
const fetch = require('node-fetch');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');

class LineBot extends EventEmitter {
	
	constructor(options) {
		super();
		this.options = options || {};
		this.options.channelId = options.channelId || '';
		this.options.channelSecret = options.channelSecret || '';
		this.options.channelAccessToken = options.channelAccessToken || '';
		if (this.options.verify === undefined) {
			this.options.verify = true;
		}
		this.headers = {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + this.options.channelAccessToken
		};
		this.endpoint = 'https://api.line.me/v2/bot';
	}
	
	verify(rawBody, signature) {
		var hash = crypto.createHmac('sha256', this.options.channelSecret).update(rawBody).digest('base64');
		return hash === signature;
	}
	
	parse(body) {
		var that = this;
		
		if (!body || !body.events) {
			return;
		}
		body.events.forEach(function (event) {
			event.reply = function (message) {
				return that.reply(event.replyToken, message);
			};
			if (event.source) {
				event.source.profile = function () {
					return that.getUserProfile(event.source.userId);
				};
			}
			if (event.message) {
				event.message.content = function () {
					return that.getMessageContent(event.message.id);
				};
			}
			that.emit(event.type, event);
		});
	}
	
	reply(replyToken, message) {
		var body = { replyToken: replyToken };
		if (typeof message === 'string') {
			body.messages = [{ type: 'text', text: message }];
		} else if (message.constructor === Array) {
			body.messages = message;
		} else {
			body.messages = [message];
		}
		return this.post('/message/reply', body).then(function(res) {
			return res.json();
		});
	}

	push(to, message) {
		var body = { to: to };
		if (typeof message === 'string') {
			body.messages = [{ type: 'text', text: message }];
		} else if (message.constructor === Array) {
			body.messages = message;
		} else {
			body.messages = [message];
		}
		return this.post('/message/push', body).then(function(res) {
			return res.json();
		});
	}
	
	getUserProfile(userId) {
		return this.get('/profile/' + userId).then(function(res) {
			return res.json();
		});
	}
	
	getMessageContent(messageId) {
		return this.get('/message/' + messageId + '/content/').then(function(res) {
			return res.buffer();
		});
	}
	
	leaveGroup(groupId) {
		return this.post('/group/' + groupId + '/leave/').then(function(res) {
			return res.json();
		});
	}
	
	leaveRoom(roomId) {
		return this.post('/room/' + roomId + '/leave/').then(function(res) {
			return res.json();
		});
	}
	
	get(path) {
		return fetch(this.endpoint + path, { method: 'GET', headers: this.headers });
	}
	
	post(path, body) {
		return fetch(this.endpoint + path, { method: 'POST', headers: this.headers, body: JSON.stringify(body) });
	}

	// Optional built-in Express app
	listen(path, port, callback) {
		var app = express(),
			parser = bodyParser.json({
    			verify: function(req, res, buf, encoding) {
					req.rawBody = buf.toString(encoding);
				}
			});
		app.post(path, parser, (req, res) => {
			if (this.options.verify && !this.verify(req.rawBody, req.get('X-Line-Signature'))) {
				return res.sendStatus(400);
			}
			this.parse(req.body);
			return res.json({});
		});
		return app.listen(port, callback);
	}

} // class LineBot

function createBot(options) {
	return new LineBot(options);
}

module.exports = createBot;
module.exports.LineBot = LineBot;
