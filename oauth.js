"use strict";

var querystring = require('querystring');
var util = require('util');

var when = require('when');

var utils = require('./utils');
var request = require('./request');

var oauth = {};
var isNode = utils.isNode();

function normalizeScope(scope) {
  // Set options.scope if not set, or convert an array into a string
  if (typeof scope === 'undefined') {
    scope = 'identity';
  } else if (util.isArray(scope)) {
    scope = scope.join(',');
  }
  return scope;
}

oauth.getAuthUrl = function(options) {
  var query = {};

  query.client_id = options.consumerKey;
  query.state = options.state;
  query.redirect_uri = options.redirectUri;
  query.duration = options.duration || 'temporary';
  query.response_type = options.response_type || 'code';
  query.scope = normalizeScope(options.scope);

  var baseUrl = 'https://www.reddit.com/api/v1/authorize';

  if (options.mobile) {
    baseUrl += '.compact';
  }

  return baseUrl + '?' + querystring.stringify(query);
};

/*
   `type` can be one of 'web', 'installed', 'script', or 'refresh'
   depending on the type of token (and accompanying auth data) is
   needed.
 */
oauth.getAuthData = function(type, options) {

  var params = {};

  params.scope = normalizeScope(options.scope);

  if (type === 'script') {
    params.grant_type = 'password';
    params.username = options.username;
    params.password = options.password;
  } else if (type === 'installed' || type === 'web') {
    params.grant_type = 'authorization_code';
    params.client_id = options.consumerKey;
    params.redirect_uri = options.redirectUri;
    params.code = options.authorizationCode;
  } else if (type === 'refresh') {
    params.grant_type = 'refresh_token';
    params.refresh_token = options.refreshToken;
  } else {
    return when.reject(new Error('invalid type specified'));
  }

  var strr = options.consumerKey + ':' + options.consumerSecret;
  var buff = new Buffer(strr, 'utf-8');
  var auth = 'Basic ' + (buff).toString('base64');

  return request.https({
    method: 'POST',
    hostname: 'ssl.reddit.com',
    path: '/api/v1/access_token',
    headers: {
      'Authorization': auth
    }
  }, querystring.stringify(params)).then(function(response) {
    var data;

    try {
      data = JSON.parse(response._body);
    } catch(e) {
      throw new Error('Failed to get Auth Data:\n' + response._body + '\n' + e.stack);
    }

    if (data.error) {
      throw new Error('Reddit Error:\n' + data.error);
    }

    return data;
  });

};

oauth.revokeToken = function(token, isRefreshToken, options) {

  var tokenTypeHint = isRefreshToken ? 'refresh_token' : 'access_token';
  var params = { token: token, token_type_hint: tokenTypeHint };

  var auth = 'Basic ' + (new Buffer(
    options.consumerKey + ':' + options.consumerSecret)).toString('base64');

  return request.https({
    method: 'POST',
    hostname: 'ssl.reddit.com',
    path: '/api/v1/revoke_token',
    headers: {
      'Authorization': auth
    }
  }, querystring.stringify(params)).then(function(response) {
    if (response._status !== 204) {
      throw new Error('Unable to revoke the given token');
    }
  });
};

module.exports = oauth;
