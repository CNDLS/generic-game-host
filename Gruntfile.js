module.exports = function (grunt) {
    "use strict";

    var sourceFiles = grunt.file.readJSON("sourceFiles.json");
    var originalJSFiles = grunt.file.readJSON("originalJSFiles.json");
    var testSpecs = grunt.file.readJSON("testSpecs.json");

    // Project configuration.
    grunt.initConfig({
        pkg : grunt.file.readJSON("static/js/package.json"),
        path : {
            main : "build/<%= pkg.name %>-<%= pkg.version %>.js",
            min : "build/<%= pkg.name %>-<%= pkg.version %>-min.js"
        },

        concat : {
            dist : {
                src : sourceFiles,
                dest : "<%= path.main %>"
            }
        },

        replace : {
            dist : {
                options : {
                    variables : {
                        "VERSION" : "<%= pkg.version %>"
                    },
                    prefix : "@",
                    force : true,
                    patterns : [
                        {
                            match : /this\._super\(\s*([\w\.]+)\s*,\s*"(\w+)"\s*(,\s*)?/g,
                            replacement : "$1.prototype.$2.apply(this$3"
                        },
                    ],
                },
                files : [
                    {
                        expand : true,
                        flatten : true,
                        src : [ "<%= path.main %>" ],
                        dest : "build/"
                    }
                ]
            },

            docs : {
                options : {
                    variables : {
                        "VERSION" : "<%= pkg.version %>"
                    },
                    prefix : "@",
                    force : true
                },
                files : [
                    {
                        expand : true,
                        src : sourceFiles.concat([ "README.md" ]),
                        dest : "build/docs/"
                    }
                ]
            }
        },

        uglify : {
            options : {
                report : "min",
                preserveComments : "some"
            },
            dist : {
                files : {
                    "<%= path.min %>" : [
                        "<%= path.main %>"
                    ]
                }
            }
        },

        jshint : {
            options : {
                jshintrc : ".jshintrc"
            },

            beforeConcat : {
                files : {
                    src : [
                        testSpecs,
                        originalJSFiles,
                        "Gruntfile.js",
                        "plugins/**/*"
                    ]
                }
            }
        },

        clean : {
            dist : [
                "<%= path.main %>",
                "<%= path.min %>"
            ],
            jsdoc : [
                "build/docs",
                "./docs/**/*.*",
                "./docs/scripts",
                "./docs/styles",
                "./docs/images",
                "./docs/img"
            ]
        },

        jsdoc : {
            dist : {
                src : sourceFiles.map(function (value) {
                    return value.replace("src/", "build/docs/src/");
                }).concat([ "README.md" ]),
                options : {
                    configure : "jsdoc_conf.json",
                    destination : "docs",
                    template : "tasks/jsdoc-template/template"
                }
            }
        },

        jasmine : {
            src : sourceFiles,
            options : {
                specs : testSpecs,
                helpers : [ "tests/spec/helper-spec.js" ],
                host : "http://localhost:8889/",
				template: require("grunt-template-jasmine-requirejs")
            }
        },

        connect : {
            server : {
                options : {
                    port : 8889
                }
            },

            keepalive : {
                options : {
                    port : 8889,
                    keepalive : true
                }
            }
        },
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-jsdoc");
    grunt.loadNpmTasks("grunt-replace");
    grunt.loadNpmTasks("grunt-contrib-jasmine");
    grunt.loadNpmTasks("grunt-contrib-connect");
    grunt.loadNpmTasks("grunt-template-jasmine-requirejs");

    // Custom Tasks
    grunt.loadTasks("tasks");

    // Default task.
    grunt.registerTask("default", [ "test", "uglify" ]);
    grunt.registerTask("build", [ "lint", "uglify" ]);
    grunt.registerTask("lint", [
        "jshint:beforeConcat",
        "concat",
        "replace:dist"
    ]);
    grunt.registerTask("doc", [ "replace:docs", "jsdoc" ]);
    grunt.registerTask("test", [ "lint", "connect:server", "jasmine" ]);
};
