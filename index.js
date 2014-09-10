#!/usr/bin/env node

var request = require('request'),
  fs = require('fs'),
  os = require('os'),
  path = require('path'),
  through = require('through2'),
  mime = require('mime'),
  debug = require('debug')('github-release');


function upload(token, repo, tag, src, dest, fn){
  debug('fetching current releases for', repo);
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
  debug('uploading %s to release %j', dest, release);
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

      if(asset.errors){
        err = asset.errors[0];
        return fn(new Error(err.resource + ': ' + err.code + ' (invalid '+err.field+')'));
      }
      release.asset = asset;

      fn(null, release);
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
  debug('release does not exist so creating a draft %j', data);
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

module.exports = function(pkg){
  return through.obj(function(file, enc, fn){
    if(!pkg.repository || !pkg.repository.url){
      return fn(new Error('Missing `repository.url` in package.json'));
    }
    var repo = /git:\/\/github.com\/([\w\/\-]+)\.git/.exec(pkg.repository.url)[1],
      token = process.env.GITHUB_TOKEN,
      tag = 'v' + pkg.version,
      dest = pkg.name + '_' + os.platform() + '_' +
        os.arch() + ((os.platform() === 'win32') ? '.exe' : ''),
      src = file.path;

    debug('uploading ' + pkg.name + '@' + pkg.version + ' ' + dest);
    upload(token, repo, tag, src, dest, function(err, release){
      if(err) return fn(err);

      debug('uploaded asset successfully %j', release.asset);
      file.github = {
        release: release,
        src: src,
        dest: dest,
        repo: repo,
        tag: tag
      };
      this.push(file);
      fn();
    }.bind(this));
  });
};

module.exports.create = createRelease;
module.exports.list = getReleases;
module.exports.upload = upload;
