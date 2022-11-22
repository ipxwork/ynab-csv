// see http://stackoverflow.com/questions/2897619/using-html5-javascript-to-generate-and-save-a-file
// see http://stackoverflow.com/questions/18662404/download-lengthy-data-as-a-csv-file
var encodings = [
  "UTF-8", "IBM866", "ISO-8859-2", "ISO-8859-3", "ISO-8859-4", "ISO-8859-5",
  "ISO-8859-6", "ISO-8859-7", "ISO-8859-8", "ISO-8859-8-I", "ISO-8859-10",
  "ISO-8859-13", "ISO-8859-14", "ISO-8859-15", "ISO-8859-16", "KOI8-R",
  "KOI8-U", "macintosh", "windows-874", "windows-1250", "windows-1251",
  "windows-1252", "windows-1253", "windows-1254", "windows-1255",
  "windows-1256", "windows-1257", "windows-1258", "x-mac-cyrillic", "GBK",
  "gb18030", "Big5", "EUC-JP", "ISO-2022-JP", "Shift_JIS", "EUC-KR",
  "replacement", "UTF-16BE", "UTF-16LE", "x-user-defined"
]
var delimiters = [
  "auto",
  ",",
  ";",
  "|"
]
var currencies = [
  "USD","CAD","EUR","AED","AFN","ALL","AMD","ARS","AUD","AZN","BAM","BDT",
  "BGN","BHD","BIF","BND","BOB","BRL","BWP","BYN","BZD","CDF","CHF","CLP",
  "CNY","COP","CRC","CVE","CZK","DJF","DKK","DOP","DZD","EEK","EGP","ERN",
  "ETB","GBP","GEL","GHS","GNF","GTQ","HKD","HNL","HRK","HUF","IDR","ILS",
  "INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KHR","KMF","KRW","KWD",
  "KZT","LBP","LKR","LTL","LVL","LYD","MAD","MDL","MGA","MKD","MMK","MOP",
  "MUR","MXN","MYR","MZN","NAD","NGN","NIO","NOK","NPR","NZD","OMR","PAB",
  "PEN","PHP","PKR","PLN","PYG","QAR","RON","RSD","RUB","RWF","SAR","SDG",
  "SEK","SGD","SOS","SYP","THB","TND","TOP","TRY","TTD","TWD","TZS","UAH",
  "UGX","UYU","UZS","VEF","VND","XAF","XOF","YER","ZAR","ZMK","ZWL"
]
var flow_cols = ["Date", "Payee", "Memo", "Outflow", "Inflow"];
var amount_cols = ["Date", "Payee", "Memo", "Amount"];
var defaultProfile = {
  columnFormat: flow_cols,
  chosenColumns: flow_cols.reduce(function (acc, val) {
    acc[val] = val;
    return acc;
  }, {}),
  useOptions: {
    exchange: false,
    amountFlow: false,
    invertedOutflow: false,
  },
  exchangeOptions: {
    currency: "USD",
    bankCurrency: "USD",
    fallbackRate: 1,
    rate: null
  },
  chosenEncoding: "UTF-8",
  chosenDelimiter: "auto",
  startAtRow: 1
};
var defaultProfiles = {
  "default": defaultProfile
};

Date.prototype.yyyymmdd = function () {
  var mm = this.getMonth() + 1; // getMonth() is zero-based
  var dd = this.getDate();

  return [this.getFullYear(),
    (mm > 9 ? '' : '0') + mm,
    (dd > 9 ? '' : '0') + dd
  ].join('');
};

angular.element(document).ready(function () {
  angular.module("app", []);
  angular.module("app").directive("fileread", [
    function () {
      return {
        scope: {
          fileread: "="
        },
        link: function (scope, element, attributes) {
          return element.bind("change", function (changeEvent) {
            var reader;
            reader = new FileReader();
            reader.onload = function (loadEvent) {
              return scope.$apply(function () {
                scope.fileread = loadEvent.target.result;
              });
            };
            reader.readAsText(changeEvent.target.files[0], attributes.encoding);
          });
        }
      };
    }
  ]);
  angular.module("app").directive("dropzone", [
    function () {
      return {
        transclude: true,
        replace: true,
        template: '<div class="dropzone"><div ng-transclude></div></div>',
        scope: {
          dropzone: "="
        },
        link: function (scope, element, attributes) {
          element.bind("dragenter", function (event) {
            element.addClass("dragging");
            event.preventDefault();
          });
          element.bind("dragover", function (event) {
            var efct;
            element.addClass("dragging");
            event.preventDefault();
            event.stopPropagation();
            var dataTransfer;
            dataTransfer = (event.dataTransfer || event.originalEvent.dataTransfer)
            efct = dataTransfer.effectAllowed;
            dataTransfer.dropEffect =
              "move" === efct || "linkMove" === efct ? "move" : "copy";
          });
          element.bind("dragleave", function (event) {
            element.removeClass("dragging");
            event.preventDefault();
          });
          element.bind("drop", function (event) {
            var reader;
            element.removeClass("dragging");
            event.preventDefault();
            event.stopPropagation();
            reader = new FileReader();
            reader.onload = function (loadEvent) {
              scope.$apply(function () {
                scope.dropzone = loadEvent.target.result;
              });
            };
            file = (event.dataTransfer || event.originalEvent.dataTransfer).files[0];
            reader.readAsText(file, attributes.encoding);
          });
          element.bind("paste", function (event) {
            var items = (event.clipboardData || event.originalEvent.clipboardData).items;
            for (var i = 0; i < items.length; i++) {
              if (items[i].type == 'text/plain') {
                data = items[i];
                break;
              }
            }
            if (!data) return;

            data.getAsString(function(text) {
              scope.$apply(function () {
                scope.dropzone = text;
              });
            });
          });
        }
      };
    }
  ]);
  // Application code
  angular.module("app")
  .config(function($locationProvider) {
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: false,
    }).hashPrefix('!');
  })
  .controller("ParseController", function ($scope, $location) {
    $scope.angular_loaded = true;

    $scope.setInitialScopeState = function () {
      $scope.newProfileName = ''
      $scope.profileName = ($location.search().profile || localStorage.getItem('profileName') || 'default').toLowerCase();
      $scope.profiles = JSON.parse(localStorage.getItem('profiles')) || defaultProfiles;
      if(!$scope.profiles[$scope.profileName]) {
        $scope.profiles[$scope.profileName] = defaultProfile;
      }
      $scope.profile = $scope.profiles[$scope.profileName];
      $scope.ynab_cols = $scope.profile.columnFormat;
      $scope.data = {};
      $scope.ynab_map = $scope.profile.chosenColumns
      $scope.exchange = $scope.profile.exchangeOptions || defaultProfile.exchangeOptions
      $scope.use = $scope.profile.useOptions
      $scope.file = {
        encodings: encodings,
        delimiters: delimiters,
        chosenEncoding: $scope.profile.chosenEncoding || defaultProfile.chosenEncoding,
        chosenDelimiter: $scope.profile.chosenDelimiter || defaultProfile.chosenDelimiter,
        startAtRow: $scope.profile.startAtRow
      };
      $scope.data_object = new DataObject();
      $scope.currencies = currencies;
    }

    $scope.setInitialScopeState();
    $scope.profileChosen = function (profileName) {
      $location.search('profile', profileName);
      $scope.profile = $scope.profiles[$scope.profileName];
      localStorage.setItem('profileName', profileName);
      $scope.setInitialScopeState()
    };
    $scope.newProfile = function (newProfileName) {
      if (!newProfileName) return
      $scope.profileName = newProfileName
      $scope.profileChosen(newProfileName)
    }
    $scope.encodingChosen = function (encoding) {
      $scope.profile.chosenEncoding = encoding;
      $scope.saveProfile()
    };
    $scope.delimiterChosen = function (delimiter) {
      $scope.profile.chosenDelimiter = delimiter;
      $scope.saveProfile()
    };
    $scope.startRowSet = function (startAtRow) {
      $scope.profile.startAtRow = startAtRow;
      $scope.saveProfile()
    };
    $scope.nonDefaultProfilesExist = function() {
      return Object.keys($scope.profiles).length > 1;
    };
    $scope.toggleExchange = function () {
      $scope.use.exchange = !$scope.use.exchange;
      $scope.profile.useOptions.exchange = $scope.use.exchange
      $scope.saveProfile()
    };
    $scope.updatePreview = function () {
      $scope.preview = $scope.data_object.converted_json(10, $scope.ynab_cols, $scope.ynab_map, $scope.use, $scope.exchange);
    },
    $scope.saveProfile = function () {
      localStorage.setItem('profiles', JSON.stringify($scope.profiles));
    },
    $scope.$watch("data.source", function (newValue, oldValue) {
      if (newValue && newValue.length > 0) {
        if ($scope.file.chosenDelimiter == "auto") {
          $scope.data_object.parseCsv(newValue, $scope.file.chosenEncoding, $scope.file.startAtRow);
        } else {
          $scope.data_object.parseCsv(newValue, $scope.file.chosenEncoding, $scope.file.startAtRow, $scope.file.chosenDelimiter);
        }
        $scope.updatePreview();
      }
    });
    $scope.$watch("use.invertedOutflow", function (newValue, oldValue) {
      if (newValue != oldValue) {
        $scope.use.invertedOutflow = newValue;
        $scope.profile.useOptions.invertedOutflow = $scope.use.invertedOutflow;
        $scope.saveProfile();
        $scope.updatePreview();
      }
    });
    $scope.$watch("use.amountFlow", function (newValue, oldValue) {
      if (newValue != oldValue) {
          if (newValue) {
            $scope.ynab_cols = flow_cols;
          } else {
            $scope.ynab_cols = amount_cols;
          }
          $scope.profile.columnFormat = $scope.ynab_cols;

          $scope.use.amountFlow = newValue;
          $scope.profile.useOptions.amountFlow = $scope.use.amountFlow;
          $scope.saveProfile();
          $scope.updatePreview();
        }
    });
    $scope.$watch('use.exchange', function (newValue, oldValue) {
      if (newValue != oldValue) {
        $scope.use.exchange = newValue;
        $scope.profile.useOptions.exchange = $scope.use.exchange;
        $scope.saveProfile();
        $scope.updatePreview();
      }
    });
    $scope.$watch(
      "ynab_map",
      function (newValue, oldValue) {
        $scope.profile.chosenColumns = newValue;
        $scope.saveProfile()
        $scope.updatePreview();
      },
      true
    );
    $scope.$watch(
      "exchange",
      function (newValue, oldValue) {
        $scope.profile.exchangeOptions = newValue;
        $scope.saveProfile()
        $scope.updatePreview();
      },
      true
    );
    $scope.csvString = function () {
      return $scope.data_object.converted_csv(null, $scope.ynab_cols, $scope.ynab_map, $scope.use.invertedOutflow, $scope.exchange);
    };
    $scope.reloadApp = function () {
      $scope.setInitialScopeState();
    }
    $scope.downloadFile = function () {
      var a;
      var date = new Date();
      a = document.createElement("a");
      a.href =
        "data:attachment/csv;base64," +
        btoa(unescape(encodeURIComponent($scope.csvString())));
      a.target = "_blank";
      a.download = `ynab_data_${date.yyyymmdd()}.csv`;
      document.body.appendChild(a);
      a.click();
    };
  });
  angular.bootstrap(document, ["app"]);
});
