const sonarqubeScanner = require('sonarqube-scanner');

function sonar(callback) {
    sonarqubeScanner(
        {
            options: {
                'sonar.sources': 'src',
                'sonar.tests': 'test',
                'sonar.projectKey': 'flowscripter_runtime',
                'sonar.projectVersion': `travis_build_${process.env.TRAVIS_BUILD_NUMBER}`,
                'sonar.links.homepage': 'https://www.npmjs.com/package/@flowscripter/runtime',
                'sonar.links.ci': 'https://travis-ci.com/flowscripter/runtime',
                'sonar.links.scm': 'https://github.com/flowscripter/runtime',
                'sonar.links.issue': 'https://github.com/flowscripter/runtime/issues',
                'sonar.typescript.lcov.reportPaths': 'reports/lcov.info',
                'sonar.eslint.reportPaths': 'reports/eslint.json'
            }
        },
        callback
    );
}

exports.sonar = sonar;
