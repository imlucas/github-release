#!/usr/bin/env node

var request = require('request'),
  fs = require('fs'),
  path = require('path'),
  through = require('through2'),
  mime = require('mime'),
  debug = require('debug')('github-release');

module.exports = function(pkg){
  var repo = pkg.repository.url.exec(/git:\/\/github.com\/([\w\/]+)\.git/)[1],
    token = process.env.GITHUB_TOKEN,
    tag = 'v' + pkg.version,
    src,
    dest;

  return through.obj(function(file, enc, fn){
    src = file.path;
    dest = path.basename(src);

    upload(repo, tag, token, src, dest, function(err, res){
      if(err) return fn(err);

      debug('Uploaded asset for release ' + tag, res);
      this.push(file);
      fn();
    }.bind(this));
  });
};


function upload(token, repo, tag, src, dest, fn){
  getReleases(token, repo, function(err, releases){
    if(err) return fn(err);
    var release = releases.filter(function(r){return r.tag_name === tag;})[0];

    if(release) return postDist(token, src, dest, release, fn);

    createRelease(token, repo, tag, '> @todo', function(err, release){
      if(err) return fn(err);
      postDist(token, src, dest, release, fn);
    });
  });
}

function postDist(token, src, dest, release, fn){
  fs.readFile(src, function(err, buf){
    var opts = {
        url: release.upload_url.replace('{?name}', ''),
        body: buf,
        qs: {name: dest, access_token: token},
        headers: {
          'Content-Type': mime.lookup(dest)
        }
      };

    request.post(opts, function(err, res, body){
      if(err) return fn(err);
      var asset = JSON.parse(body);

      release.asset = asset;
      fn(null, asset);
    });
  });
}

function createRelease(token, repo, tag, body, fn){
  var data = {
    tag_name: tag,
    draft: true,
    name: tag,
    body: body
  };
  var url = 'https://api.github.com/repos/' + repo + '/releases';
  request.post(url, {
    qs: {access_token: token},
    body: JSON.stringify(data),
    headers: {'User-Agent': '@imlucas/github-release uploader'}
  }, function(err, res, body){
    if(err) return fn(err);
    fn(null, JSON.parse(body));
  });
}

function getReleases(token, repo, fn){
  var url = 'https://api.github.com/repos/' + repo + '/releases';
  request.get(url, {qs: {access_token: token}, headers: {
    'User-Agent': '@imlucas/github-release uploader'
  }}, function(err, res, body){
    if(err) return fn(err);
    fn(null, JSON.parse(body));
  });
}