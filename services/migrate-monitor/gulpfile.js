'use strict';

const path = require('path');
const util = require('util');

const gulp = require('gulp');
const babel = require('gulp-babel');
const eslint = require('gulp-eslint');
const sourcemaps = require('gulp-sourcemaps');
const typescript = require('gulp-typescript');

const sources = 'src/**/*.ts';

const project = typescript.createProject('./tsconfig.json');

function lint() {
  return gulp
    .src(sources, { since: gulp.lastRun(lint) })
    .pipe(eslint({ formatter: 'codeFrame' }))
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
}

function compile() {
  return project
    .src()
    .pipe(sourcemaps.init())
    .pipe(project())
    .js.pipe(babel())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('lib'));
}

const build = gulp.series(lint, compile);

function watch() {
  gulp.watch(sources, build);
}

exports.default = build;
exports.watch = gulp.series(build, watch);
