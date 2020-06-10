const sonarqubeScanner = require('sonarqube-scanner');

function sonar(callback) {
    sonarqubeScanner(
        {
            options: {
                'sonar.sources': 'src',
                'sonar.tests': 'test',
                'sonar.projectKey': 'flowscripter_ts-template',
                'sonar.projectVersion': `travis_build_${process.env.TRAVIS_BUILD_NUMBER}`,
                'sonar.links.homepage': 'https://www.npmjs.com/package/@flowscripter/ts-template',
                'sonar.links.ci': 'https://travis-ci.com/flowscripter/ts-template',
                'sonar.links.scm': 'https://github.com/flowscripter/ts-template',
                'sonar.links.issue': 'https://github.com/flowscripter/ts-template/issues',
                'sonar.typescript.lcov.reportPaths': 'reports/lcov.info',
                'sonar.eslint.reportPaths': 'reports/eslint.json'
            }
        },
        callback
    );
}

exports.sonar = sonar;
