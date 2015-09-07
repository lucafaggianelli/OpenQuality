var fs = require('fs');
var archiver = require('archiver');
var NwBuilder = require('nw-builder');
var gulp = require('gulp');
var gutil = require('gulp-util');
var manifest = require('./app/package.json');

gulp.task('build', function () {

    var nw = new NwBuilder({
        version: '0.12.3',
        files: './app/**',
        //macIcns: './icons/icon.icns',
        //macPlist: {mac_bundle_id: 'myPkg'},
        platforms: ['win64', 'linux64']
    });

    // Log stuff you want
    nw.on('log', function (msg) {
        gutil.log('nw-builder', msg);
    });

    // Build returns a promise, return it so the task isn't called in parallel
    return nw.build().catch(function (err) {
        gutil.log('nw-builder', err);
    });
});

gulp.task('pack-linux', ['build'], function (done) {
    var output = fs.createWriteStream(__dirname + '/build/OpenQuality-'+manifest.version+'-linux64.tar.gz');
    //var archive = archiver('zip');
    var archive = archiver('tar', {
      gzip: true,
      gzipOptions: {
        level: 1
      }
    });

    output.on('close', function() {
      gutil.log(archive.pointer() + ' total bytes');
      gutil.log('Archiver has been finalized and the output file descriptor has closed.');
      done();
    });

    archive.on('error', function(err) {
      done(err);
    });

    archive.pipe(output);

    archive.bulk([
        { cwd: 'build/OpenQuality/linux64', src: ['**'], expand: true }
    ]);

    archive.finalize();
});

gulp.task('pack-win', ['build'], function (done) {
    var output = fs.createWriteStream(__dirname + '/build/OpenQuality-'+manifest.version+'-windows64.zip');
    var archive = archiver('zip');

    output.on('close', function() {
      gutil.log(archive.pointer() + ' total bytes');
      gutil.log('Archiver has been finalized and the output file descriptor has closed.');
      done();
    });

    archive.on('error', function(err) {
      done(err);
    });

    archive.pipe(output);

    archive.bulk([
        { cwd: 'build/OpenQuality/win64', src: ['**'], expand: true }
    ]);

    archive.finalize();
});

gulp.task('default', ['build', 'pack-linux', 'pack-win']);
