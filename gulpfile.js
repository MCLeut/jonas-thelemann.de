'use strict';

const gAutoprefixer = require('gulp-autoprefixer');
const gBabel = require('gulp-babel');
const gBabelMinify = require('gulp-babel-minify');
const gCached = require('gulp-cached');
const gConcat = require('gulp-concat');
const gComposer = require('gulp-composer');
const gDel = require('del');
const gFs = require('fs');
const gGulp = require('gulp');
const gJsdoc2md = require('jsdoc-to-markdown');
const gMergeStream = require('merge-stream');
const gPath = require('path');
const gRename = require('gulp-rename');
const gSass = require('gulp-sass');
const gSourcemaps = require('gulp-sourcemaps');
const gStreamToPromise = require('gulp-stream-to-promise');
const gVfs = require('vinyl-fs');
const gYarn = require('gulp-yarn');
const gZip = require('gulp-zip');

// const debug = require('gulp-debug');
// .pipe(debug())

var pkg = JSON.parse(gFs.readFileSync('./package.json'));

const distFolder = 'dist/' + pkg.name + '/';
const distCredentialsFolder = distFolder + 'credentials/';
const distServerFolder = distFolder + 'server/';
const srcFolder = 'src/';
const staticFolder = srcFolder + 'static/';
const funcFolder = srcFolder + 'js/functions/';
const styleFolder = srcFolder + 'css/sass/style/';
const sassFile = srcFolder + 'css/sass/style/style.scss';
const resFolder = distServerFolder + 'resources/';
const baseFolder = resFolder + 'dargmuesli/base/';
const depComposerFolder = resFolder + 'packages/composer/';
const depYarnFolder = resFolder + 'packages/yarn/';
const credentialsSrcGlob = 'credentials/**';
const staticGlob = staticFolder + '**';
const composerSrcGlob = 'vendor/**';
const zipSrcGlob = distFolder + '**';
const mod = (__dirname.includes(process.cwd()) ? process.cwd() : __dirname) + '/node_modules/';

var buildInProgress = false;

gGulp.src = gVfs.src;
gGulp.dest = gVfs.dest;

function dist_clean() {
    // Delete all files from dist folder
    return gDel([distFolder + '**', '!' + distFolder.replace(/\/$/, ''), gPath.dirname(distFolder) + '/' + pkg.name + '.zip']);
}

exports.dist_clean = dist_clean;

function credentials() {
    // Copy credentials to dist folder
    return gGulp.src(credentialsSrcGlob, { dot: true })
        .pipe(gCached('credentials'))
        .pipe(gGulp.dest(distCredentialsFolder));
}

exports.credentials = credentials;

function credentials_watch() {
    // Watch for any changes in credential files to copy changes
    // Does currently not work as dotfiles cannot be watched with chokidar
    gGulp.watch(credentialsSrcGlob)
        .on('all', function (event, path) {
            credentials();
        });
}

exports.credentials_watch = credentials_watch;

function staticSrc() {
    // Copy static files to dist folder
    buildInProgress = true;

    return new Promise(function (resolve, reject) {
        gGulp.src(staticGlob, { dot: true })
            .pipe(gCached('staticSrc'))
            .on('error', reject)
            .pipe(gGulp.dest(distServerFolder))
            .on('end', resolve);
    }).then(function () {
        buildInProgress = false;
    });
}

exports.staticSrc = staticSrc;

function staticSrc_watch() {
    // Watch for any changes in source files to copy changes
    gGulp.watch(staticGlob)
        .on('all', function (event, path) {
            staticSrc();
        });
}

exports.staticSrc_watch = staticSrc_watch;

function jsSrc() {
    return gGulp.src(funcFolder + '*.js')
        .pipe(gConcat('functions.js'))
        .pipe(gBabel({
            presets: [
                [mod + 'babel-preset-env']
            ]
        }))
        .pipe(gGulp.dest(baseFolder))
        .pipe(gRename({
            extname: '.min.js'
        }))
        .pipe(gBabelMinify())
        .pipe(gGulp.dest(baseFolder));
}

exports.jsSrc = jsSrc;

function jsDoc() {
    return gJsdoc2md.render({ files: funcFolder + '*.js' })
        .then(output => gFs.writeFile('docs/js/functions.md', output, (error) => { console.log(error) }));
}

exports.jsDoc = jsDoc;

function jsSrc_watch() {
    // Watch for any changes in source files to copy changes
    gGulp.watch(funcFolder)
        .on('all', function (event, path) {
            jsSrc();
        });
}

exports.jsSrc_watch = jsSrc_watch;

function css_compressed() {
    return gGulp.src(sassFile)
        .pipe(gRename({
            extname: '.min.css'
        }))
        .pipe(gSourcemaps.init())
        .pipe(gSass({
            outputStyle: 'compressed'
        }).on('error', gSass.logError))
        .pipe(gAutoprefixer())
        .pipe(gSourcemaps.write('.'))
        .pipe(gGulp.dest(baseFolder));
}

exports.css_compressed = css_compressed;

function css_extended() {
    return gGulp.src(sassFile)
        .pipe(gSourcemaps.init())
        .pipe(gSass({
            outputStyle: 'expanded'
        }).on('error', gSass.logError))
        .pipe(gAutoprefixer())
        .pipe(gSourcemaps.write('.'))
        .pipe(gGulp.dest(baseFolder));
}

exports.css_extended = css_extended;

function cssSrc_watch() {
    // Watch for any changes in source files to copy changes
    gGulp.watch(styleFolder)
        .on('all', function (event, path) {
            css_compressed();
            css_extended();
        });
}

exports.cssSrc_watch = cssSrc_watch;

function composer_update() {
    // Update composer
    return gComposer('update', {
        'async': false
    });
}

exports.composer_update = composer_update;

function composer_clean() {
    // Delete all files from composer package resources dist folder
    return gDel(depComposerFolder + '*');
}

exports.composer_clean = composer_clean;

function composer_src() {
    // Copy all composer libraries to composer package resources dist folder
    return gGulp.src(composerSrcGlob)
        .pipe(gGulp.dest(depComposerFolder));
}

exports.composer_src = composer_src;

function composer_watch() {
    // Watch for any changes in composer files to copy changes
    gGulp.watch([composerSrcGlob, "composer.json"])
        .on('all', function (event, path) {
            composer_update();
            composer_src();
        });
}

exports.composer_watch = composer_watch;

function yarn_update() {
    // Update package dependencies
    return gGulp.src("package.json")
        .pipe(gYarn());
}

exports.yarn_update = yarn_update;

function yarn_clean() {
    // Delete all files from yarn package resources dist folder
    return gDel(depYarnFolder + '*');
}

exports.yarn_clean = yarn_clean;

function yarn_src() {
    // Copy front-end javascript libraries to yarn package resources dist folder
    const streamArray = [gGulp.src('node_modules/chart.js/dist/Chart{.min,}.js')
        .pipe(gGulp.dest(depYarnFolder + 'chart.js/')),
    gGulp.src('node_modules/dragula/dist/*.{css,js}')
        .pipe(gGulp.dest(depYarnFolder + 'dragula/')),
    gGulp.src('node_modules/jquery/dist/jquery*.js')
        .pipe(gGulp.dest(depYarnFolder + 'jquery/')),
    gGulp.src('node_modules/jquery-validation/dist/{localization/,jquery.validate}*.js')
        .pipe(gGulp.dest(depYarnFolder + 'jquery-validation/')),
    gGulp.src('node_modules/js-cookie/src/*.js')
        .pipe(gGulp.dest(depYarnFolder + 'js-cookie/')),
    gGulp.src('node_modules/later/later{.min,}.js')
        .pipe(gGulp.dest(depYarnFolder + 'later/')),
    gGulp.src('node_modules/materialize-css/dist/**')
        .pipe(gGulp.dest(depYarnFolder + 'materialize-css/')),
    gGulp.src(['node_modules/moment/moment*.js', 'node_modules/moment/min/moment*.js'])
        .pipe(gGulp.dest(depYarnFolder + 'moment/')),
    gGulp.src(['node_modules/moment-timezone/moment-timezone.js', 'node_modules/moment-timezone/builds/*.js'])
        .pipe(gGulp.dest(depYarnFolder + 'moment-timezone/')),
    gGulp.src('node_modules/prismjs/{components/*.js,plugins/*,themes/*.css,prism.js}')
        .pipe(gGulp.dest(depYarnFolder + 'prismjs/'))];
    return gMergeStream(streamArray);
}

exports.yarn_src = yarn_src;

function yarn_watch() {
    // Watch for any changes in yarn files to copy changes
    gGulp.watch(["package.json"])
        .on('all', function (event, path) {
            yarn_update();
            yarn_src();
        });
}

exports.yarn_watch = yarn_watch;

function symlinks(callback) {
    // Create all necessary symlinks
    return callback();
}

exports.symlinks = symlinks;

function zip() {
    // Build a zip file containing the dist folder
    return gGulp.src(zipSrcGlob, { dot: true })
        .pipe(gZip(pkg.name + '.zip'))
        .pipe(gGulp.dest(gPath.dirname(distFolder)));
}

exports.zip = zip;

function zipWaiter() {
    // Do not zip while a build is still in progress
    if (buildInProgress) {
        setTimeout(zipWaiter, 100);
    } else {
        zip();
    }
}

function zip_watch() {
    // Watch for any changes to start a zip rebuild
    gGulp.watch(zipSrcGlob)
        .on('all', function (event, path) {
            console.log(event + ': "' + path + '". Running tasks...');
            zipWaiter();
        });
}

exports.zip_watch = zip_watch;

// Build tasks
gGulp.task('build', gGulp.series(dist_clean, gGulp.parallel(credentials, staticSrc, jsSrc, css_compressed, css_extended, gGulp.series(composer_update, composer_src), gGulp.series(yarn_update, yarn_src)), symlinks, zip));
gGulp.task('default', gGulp.series('build', gGulp.parallel(credentials_watch, staticSrc_watch, jsSrc_watch, cssSrc_watch, composer_watch, yarn_watch, zip_watch)));