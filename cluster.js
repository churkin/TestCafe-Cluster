var TestCafe = require('C:\\Program Files (x86)\\DevExpress\\TestCafe\\Tools\\index').TestCafe, 
    http = require('http'); 
  
var BASE_PORT_VALUE = 1500, 
    HTTP_SERVICE_PORT = 1499, 
    SERVER_HOSTNAME = 'machine-name', 
    TESTS_DIR = 'D:\\Tests', 
    
	TESTCAFE_INSTANCES_COUNT = 4; 
  
var suite = null, 
    runOptions = { 
        sourceType: 'dir', 
        source: 'test', 
        browsers: [], 
        workers: [], 
        emulateCursor: true
    }; 
  
var mergeReport = function (report) { 
    if (suite) { 
        if (suite.status === 'succeeded' || suite.status === 'failed') 
            suite.status = report.status; 
  
        suite.completedAt = report.completedAt; 
        suite.testCount = suite.testCount + report.testCount; 
        suite.failed = suite.failed + report.failed; 
        suite.passed = suite.passed + report.passed; 
        suite.workerNames = suite.workerNames.concat(report.workerNames); 
  
        Object.keys(report.testErrReports).forEach(function (key) { 
            suite.testErrReports[key] = report.testErrReports[key]; 
        }); 
    } else
        suite = report; 
}; 
  
var runHttpService = function (cluster, serverCount) { 
    var workerIndex = 0; 
  
    http.createServer(function (req, res) { 
        if (req.url === '/run_tests') { 
            cluster.runTests(runOptions, function (report) { 
                if (report.failed == 0) { 
                    console.log("All tests passed successfully!"); 
                    process.exit(0); 
                } 
                else { 
                    console.log(JSON.stringify(report, null, 4)); 
                    process.exit(1); 
                } 
            }); 
  
            res.writeHead(200, {'Content-Type': 'text/plain'}); 
            res.end(); 
        } else if (/^\/worker\/add\//.test(req.url)) { 
            var name = req.url.replace(/^\/worker\/add\//, ''); 
  
            res.writeHead(302, { 
                'Location': ['http://', SERVER_HOSTNAME, ':', (BASE_PORT_VALUE + workerIndex * 2), '/worker/add/', name].join('') 
            }); 
  
            workerIndex++; 
  
            if (workerIndex >= serverCount) 
                workerIndex = 0; 
  
            res.end(); 
        } 
    }).listen(HTTP_SERVICE_PORT); 
}; 
  
var makeCluster = function (serverCount) { 
    var cluster = { 
            instances: [] 
        }, 
        completedTasksCount = 0; 
  
    for (var i = 0; i < serverCount; i++) { 
        var itemConfig = { 
            hostname: SERVER_HOSTNAME, 
            browsers: {}, 
            testsDir: TESTS_DIR, 
            controlPanelPort: BASE_PORT_VALUE + i * 2, 
            servicePort: BASE_PORT_VALUE + i * 2 + 1 
        }; 
  
        cluster.instances.push(new TestCafe(itemConfig)); 
    } 
  
    cluster.runTests = function (options, callback) { 
        cluster.instances.forEach(function (testcafe) { 
            options.workers = testcafe.listConnectedWorkers(); 
  
            testcafe.runTests(options); 
  
            testcafe.on('taskComplete', function (report) { 
                mergeReport(report); 
  
                completedTasksCount++; 
  
                if (completedTasksCount === serverCount) { 
                    suite.name = 'Tests results'; 
                    suite.uid = ''; 
  
                    callback(suite); 
                } 
            }); 
        }); 
    }; 
  
    runHttpService(cluster, serverCount); 
}; 
  
makeCluster(TESTCAFE_INSTANCES_COUNT);