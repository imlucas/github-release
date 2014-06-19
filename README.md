# github-release

Upload releases to github.


## Example

Set the `GITHUB_TOKEN` environment variable in your `.profile`

```
gulp.task('release', function(){
  var pkg = require('./package.json'),
    release = require('github-release');

  gulp.src('./dist/some-file.exe')
    .pipe(release(pkg));
});
```

## License

MIT
