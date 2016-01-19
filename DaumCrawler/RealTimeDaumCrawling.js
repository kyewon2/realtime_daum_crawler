/**
 * Created by Kyewon on 2016. 1. 13..
 */

var request = require("request"),
    cheerio = require("cheerio"),   //태그부분만 가져오는 변수
    express = require('express'),
    http = require('http'),
    fs = require('fs'),
    ejs = require('ejs'),
    async = require('async');
    mongoose = require('mongoose'); //db
    mongoose.connect('mongodb://localhost:27017/test2');

var url = "http://daum.net"; //crawing url

var daumSchema = new mongoose.Schema({
        'keyword': { type: Array, required: true},
        'datetime' : {type: Date, default: Date.now()}
});
var daumkeyword = mongoose.model('daumkeyword',daumSchema);


setInterval(retimer, 5000); //주기 타이머
function retimer() {
    request(url, function (error, response, html) {

        if (error)
            return;

        var $ = cheerio.load(html),
            liList = $("ol[class='list_issue #searchrank']"),
            keywordlist = $("span[class='txt_issue']"),
            sb = []; //파싱된 배열 담는 변수
        liList.each(function () {
            keywordlist.each(function (i, elem) {
                if (i % 2 == 0)
                    sb.push($(this).text().replaceAll("\n", ""));
            });
        });
        insertdaum(sb, function (sb) {
            if(sb == null){
                console.log("sb is null");
                return;
            }
        });
    });
}

//insert
var insertdaum = function(sb){
    var daumCraw = new daumkeyword();   //db 객체 생성
    daumCraw.keyword = sb;

    daumCraw.save(function (err) {
        if (err) {
            console.log("save err");
            mongoose.disconnect();
        }
        else
            console.log("success saved");
    });
    console.log(sb);
}


//aggregate function
var aggregatedaum = function() {
    var daytime = new Date("2016/1/14");
    daumkeyword.aggregate([
            {$unwind: "$keyword"}, //Array -> String
            {$match: {datetime: {$gt: daytime}}},
            {$group : {_id : '$keyword', count: {'$sum' : 1}}},
            {$sort : { count : -1} },
            {$limit : 10 }
        ], function (err, result) {
            if(err) {
                console.log(err);
                return;
            }
        console.log(result);
        return result;
    });
}


//String replaceAll
String.prototype.replaceAll = function (org, dest) {
    return this.split(org).join(dest);
}

var app = express(); //서버 생성
//express 3.0 up version
app.use(express.json());
app.use(express.urlencoded());

//서버 실행
http.createServer(app).listen(52263, function(){
    console.log("running server");
});

//출력 기간 설정
var times = function(num){
    var today = new Date();
    var dd = today.getDate(),
        mm = today.getMonth()+ 1,
        yyyy = today.getFullYear();

    if(dd<10) {
        dd='0'+dd;
    }
    if(mm<10) {
        mm='0'+mm;
    }

    switch (num) {
        case 7 : dd = dd - 7;
            today = mm+'/'+dd+'/'+yyyy;
            //console.log(today);
            return today;break;
        case -1 : dd = dd - 1;
            today = mm+'/'+dd+'/'+yyyy;
            //console.log(today);
            return today;break;
        case 1 :
            today = mm+'/'+dd+'/'+yyyy;
            //console.log(today);
            return today;break;
    }
}

app.get('/', function (req, res) {
    //파일 읽기
    fs.readFile('TableDaum.html','utf8', function(err, data){
        var Dday = new Date(times(1));
        var Wday = new Date(times(7));
        var Yday = new Date(times(-1));
        var jsonText = [];
        async.parallel([
                function(callback){
                    daumkeyword.aggregate([
                        {$unwind: "$keyword"}, //Array -> String
                        {$match: {datetime: {$lte: Dday, $gt: Wday}}},
                        {$group : {_id : '$keyword', count: {'$sum' : 1}}},
                        {$sort : { count : -1} },
                        {$limit : 10 }
                    ], function (err, weekResult) {

                        if(err) {
                            console.log(err);
                            return;
                        }
                        //console.log(weekResult);
                        callback(null, {'weekResult':weekResult});
                    });
                },
                function(callback){
                    daumkeyword.aggregate([
                        {$unwind: "$keyword"}, //Array -> String
                        {$match: {datetime: {$lte: Dday, $gt: Yday}}},
                        {$group : {_id : '$keyword', count: {'$sum' : 1}}},
                        {$sort : { count : -1} },
                        {$limit : 10 }
                    ], function (err, dayResult) {

                        if(err) {
                            console.log(err);
                            return;
                        }
                        //console.log(dayResult);
                        callback(null, {'dayResult':dayResult});
                    });
                }
            ],
            function(err, aggResults){
                console.log('%%%');
                aggResults.forEach(function(re)
                {
                    jsonText.push(re);
                });
                console.log(jsonText[0]);
                res.send(ejs.render(data, {weekResult: jsonText[0], dayResult : jsonText[1]}));
            });
    });
});