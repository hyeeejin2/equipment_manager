const createError=require('http-errors');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const FileStore=require('session-file-store')(session);
const mysql = require('mysql');
const dateformat = require('dateformat');
const QRCode = require('qrcode');
const fileUpload = require('express-fileupload');
const moment = require('moment');
const logger=require('morgan');
require('ejs');

//var indexRouter=require('./routes/index');
//var usersRouter=require('./routes/users');

var app = express();
var loggedInUser=[];
var pool = mysql.createPool({
	host : 'localhost',
	port : 3306,
	user : 'equipment_manager',
	password : 'habitualtask1418',
	database : 'EQUIPMENT_MANAGER',
	connectionLimit : 10
});

function isLoggedIn(id, sid){
	if(loggedInUser.length===0){
		return true;
	}
	else {
		for(var i=0;i<loggedInUser.length;i++)
		{
			if(loggedInUser[i][0]===id && loggedInUser[i][1]!==sid) {
				loggedInUser.splice(loggedInUser.indexOf(loggedInUser[i]), 1, ([loggedInUser[i][0], loggedInUser[i][1], false]));
				console.log("이미 있다");
				return true;
			}
			else {
				console.log("없다");
				return true;
			}
		}
	}
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('port', process.env.PORT || 80);

var loginCheck=function(request, response, next){
	var user=request.session.user;
	var count=0;
	if(user){
		for(var i=0;i<loggedInUser.length;i++)
		{
			if(loggedInUser[i][0]==user.id && loggedInUser[i][1]===user.sid && loggedInUser[i][2]===false){
				count++;
				loggedInUser.splice(loggedInUser.indexOf(user.id, user.sid, false),1);
				request.session.destroy(function(err){
					if(err) {
						console.error(err);
					} else {
						response.clearCookie('connect.sid');
		            response.redirect('/');      
					}
				});
      	}
    	}	
		if(count===0){
			next();
    	}
	} else {
		next();
	}
};

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/equipment', express.static(path.join(__dirname, 'public')));
app.use('/equipment/detail', express.static(path.join(__dirname, 'public')));
app.use(session({
	secret:'secret',
	resave:false,
	saveUninitialized:false,
	store:new FileStore({path:'./sessions', logFn:function(){}})
}));
app.use(loginCheck);
app.use(fileUpload());
//app.use('/', indexRouter);
//app.use('/users', usersRouter);
/*app.use(ferrunction(request, response, next){
  next(createError(404));
});
app.use(function(err, request, response, next){
  response.locals.message=err.message;
  response.locals.error=request.app.get('env')==='development' ? err : {};
  response.status(err.status || 500);
  response.render('error');
});*/

app.get('/', function(request, response){
	if(request.session.user){
		response.render('index', {name:request.session.user.name});
	} else {
		response.render('index');
	}
});

app.get('/login', function(request, response){
	if(request.session.user){
		response.redirect('/');
	} else {
    	response.render('login');
  }
});

app.post('/loginProcess', function(request, response){
	var body=request.body;
	var data=[body.id, body.pw];

	pool.getConnection(function(err, connection){
		var sql="SELECT user_name FROM USER_INFO WHERE user_id=? and password=?;";
		connection.query(sql, data, function(err, result, fields){
			if(err){
				connection.release();
				response.send('error : '+err);
			} else {
				connection.release();
				if(result.length){
					request.session.user={
						'id':data[0],
						'name':result[0].user_name,
						"sid": request.sessionID,
						"logged_in": true
      	 		};
					var check=isLoggedIn(data[0], request.sessionID);
					if(check){
						loggedInUser.push([data[0], request.sessionID, true]);
						response.redirect('/');
					}
				} else {
					response.redirect('/');
				} 
			}
		});
	});
});

app.get('/signup', function(request, response){
	response.render('signup');
});
app.post('/signupProcess', function(request, response){
	var body=request.body;
	var no=0;
	
	if(body.pw!==body.pwCheck){
		response.redirect('signup');
	} else {
		pool.getConnection(function(err, connection){
			var sql="SELECT user_num from USER_INFO WHERE user_id = ? or email=?;";
			var data=[body.id, body.email];
			connection.query(sql, data, function(err, result, fields){
				if(err) {
					connection.release();
					response.send('error : '+err);
				} else {
					if(result.length){
						connection.release();
						response.redirect('signup');
					} else {
						sql="SELECT count(*) AS count FROM USER_INFO;";
						connection.query(sql, function(err, result, fields){
							if(err) {
								connection.release();
								response.send('error : '+err);
							} else {
								no=result[0].count+1;
								var data={
									'user_num':no,
							            	'user_id':body.id,
	            							'password':body.pw,
					        			'user_name':body.name,
									'email':body.email,
									'c_num':body.company,
									'd_num':body.department,
									'p_num':body.position,
			            					'mac':body.mac
								};
								sql="INSERT INTO USER_INFO SET ?;";
								connection.query(sql, data, function(err, result, fields){
									if(err ){
										connection.rollback();
										connection.release();
						 				response.send('error : '+err);
									} else {
										connection.commit();
				                  				connection.release();
			                  					response.redirect('/login');
									}
				            			});
      	   						}
		   	   			}); 
					}
				} 
			});
		});
	}
});

app.get('/logout', function(request, response){
	if(request.session.user) {
		loggedInUser.splice(loggedInUser.indexOf(request.session.user.id, request.sessionID, true),1);
		request.session.destroy(function(err){
			if(err) {
				console.error(err);
			} else {
				response.clearCookie('connect.sid');
				response.redirect('/');      
      	}
		});
	} else {
		response.redirect('/');
	}
});

app.get('/notice/main', function(request, response){
	if(request.session.user) {
		response.render('notice.ejs', {name:request.session.user.name});
	} else {
		response.render('notice.ejs');
	}   
});
app.get('/notice/listProcess', function(request, response){
	pool.getConnection(function(err, connection){
		var sql='SELECT notice_title, user_name, reporting_date, notice_content, views FROM NOTICE_INFO, USER_INFO WHERE USER_INFO.user_num=NOTICE_INFO.user_num';
		connection.query(sql, function(err, result, fields){
			if(err) {
				connection.release();
				response.send('error : '+err);
			} else {
				connection.release();
				var dataList=[];
				for(var i=0;i<result.length;i++)
				{
					var temp={
						'notice_num':i+1,
						'notice_title':result[i].notice_title,
						'user_name':result[i].user_name,
						'reporting_date':result[i].reporting_date,
						'views':result[i].views,
						'notice_content':result[i].notice_content
					};
					dataList.push(temp);
				}
				var json={'data':dataList};
				response.send(json);
			}
		});
	});
});  	

app.get('/notice/detail/:noticeID', function(request, response){
	if(request.session.user) {
		var noticeID=[request.params.noticeID];
		pool.getConnection(function(err, connection){
			var sql="SELECT EXISTS (SELECT * FROM NOTICE_INFO WHERE notice_num=?) AS success;";
			connection.query(sql, noticeID, function(err, result, fields){
				if(err) {
					connection.release();
				        response.send('error : '+err);
				} else {
					if(!result[0].success) {
						connection.release();
						response.redirect("/notice/main");
					} else {
						sql="UPDATE NOTICE_INFO SET views = views+1 WHERE notice_num=?;";
						connection.query(sql, noticeID, function(err, result, fields){
							if(err) {
								connection.rollback();
						                connection.release();
								response.send('error : '+err);
							} else {
								connection.commit();
								sql="SELECT notice_title, user_name, reporting_date, notice_content FROM NOTICE_INFO, USER_INFO WHERE USER_INFO.user_num=NOTICE_INFO.user_num and notice_num=?;";
								connection.query(sql, noticeID, function(err, result, fields){
									if(err) {
										connection.release();
										response.send('error : '+err);
									} else {
										connection.release();
										response.render('notice_detail', {
											name:request.session.user.name,
											result:result[0],
											noticeID:noticeID
										});
									}
								});
							}
						});
					}
				}
			});	
		});
	} else {
		response.redirect('/');
	}
});

app.get('/notice/write', function(request, response){
	if(request.session.user) {
		var date=dateformat(new Date(),'yyyy-mm-dd');
		response.render('notice_write.ejs', {
			name:request.session.user.name,
			date:date
		});
	} else {
		response.redirect('/');
	}	
});

app.post('/notice/writeProcess', function(request, response){
	if(request.session.user) {
		var body=request.body;
		var no=0;
		var user=0;

		pool.getConnection(function(err, connection){
			var sql="SELECT count(*) AS count FROM NOTICE_INFO;";
			connection.query(sql, function(err, result, fields){
				if(err) {
					connection.release();
					response.send('error : '+err);
				} else {
					no=result[0].count+1;
					sql="SELECT user_num FROM USER_INFO WHERE user_name=?;";
					connection.query(sql, [body.id], function(err, result, fields){
						if(err) {
							connection.release();
							response.send('error : '+err);
						} else {
							user=result[0].user_num;
							sql="INSERT INTO NOTICE_INFO SET ?;";
							var data={
								'notice_num':no,
								'c_num':1,
								'user_num':user,
								'notice_title':body.title,
								'reporting_date':body.date,
								'notice_content':body.content,
								'views':0
							};
							connection.query(sql, data, function(err, result, fields){
								if(err) {
									connection.rollback();
					                	        connection.release();
									response.send('error : '+err);
								} else {
									connection.commit();
									connection.release();
						                        response.redirect('/notice/main');
								}
							});
						}
					});
				}
			});
		});
	} else {
		response.redirect('/');
	}
});

app.post('/notice/modifyProcess', function(request, response){
	if(request.session.user) {
		var body=request.body;
		var data=[body.title, body.content, body.noticeID];
		console.log(data);
		pool.getConnection(function(err, connection){
			var sql="UPDATE NOTICE_INFO SET notice_title=?, notice_content=? WHERE notice_num=?;";
			connection.query(sql, data, function(err, result, fields){
				if(err) {
					connection.rollback();
					connection.release();
					response.send('error : '+err);
				} else {
					connection.commit();
					connection.release();
					response.redirect('/notice/main');
				}
			});
		});
	} else {
		response.redirect('/');
	}   
});
app.post('/notice/deleteProcess', function(request, response){
	if(request.session.user) {
		var noticeID=[request.body.noticeID];
		console.log(request.body);
		pool.getConnection(function(err, connection){
			var sql="DELETE FROM NOTICE_INFO WHERE notice_num=?;";
			connection.query(sql, noticeID, function(err, result, fields){
				if(err) {
					connection.rollback();
					connection.release();
					response.send('error : '+err);
				} else {
					connection.commit();
            				response.redirect('/notice/main');
   				}
               		});
		});
	} else {
		response.redirect('/');
	}   
});


app.get('/equipment/main', function(request, response){
	if(request.session.user) {
		response.render('equipment.ejs', {name:request.session.user.name});
	} else {
		response.redirect('/');
	}
});
app.get('/equipment/listProcess', function(request, response){
	pool.getConnection(function(err, connection){
		var sql='SELECT G_NUM, EQUIPMENT_NAME, EQUIPMENT_PICTURE FROM EQUIPMENT_INFO;';
                connection.query(sql, function(err, result, fields){
                        if(err) {
                                connection.release();
                                response.send('error : '+err);
                        } else {
                                connection.release();
                                var dataList=[];
                                for(var i=0;i<result.length;i++)
                                {
                                        var temp={
                                                'equipment_kind':result[i].G_NUM,
                                                'equipment_num':i+1,
						'equipment_picture':result[i].EQUIPMENT_PICTURE,
                                                'equipment_name':result[i].EQUIPMENT_NAME
                                        };
                                        dataList.push(temp);
                                }
                                var json={'data':dataList};
                                response.send(json);
                        }
                });
        });
});
app.get('/equipment/detail/:equipmentID', function(request, response){
	if(request.session.user){
		var equipmentID=[request.params.equipmentID];
		pool.getConnection(function(err, connection){
        		var sql="SELECT EXISTS (SELECT * FROM EQUIPMENT_INFO WHERE EQUIPMENT_NUM=?) AS success;";
	                connection.query(sql, equipmentID, function(err, result, fields){
        	                if(err) {
                	                connection.release();
                        	        response.send('error : '+err);
	                        } else {
        	                        if(!result[0].success) {
                	                        connection.release();
                        	                response.redirect("/equipment/main");
                                	} else {
						sql="SELECT G_NAME, EQUIPMENT_NAME, EQUIPMENT_SERIAL, PUBLISHER_NAME, PURCHASE_PRICE, PURCHASE_DATE, REMARK FROM EQUIPMENT_INFO, GOODS WHERE EQUIPMENT_NUM=? AND GOODS.G_NUM=EQUIPMENT_INFO.G_NUM;";
						connection.query(sql, equipmentID, function(err, result, fields){
							if(err) {
								connection.release();
								response.send('error : '+err);
							} else {
								resultDetail=result[0];
								sql="SELECT EXISTS (SELECT * FROM USER_EQUIPMENT_MAPPING WHERE EQUIPMENT_NUM=?) AS success;";
								connection.query(sql, equipmentID, function(err, result, fields){
									if(err) {
										connection.release();
										response.send('error : '+err);
									} else {
										if(!result[0].success) {
											connection.release();
											var state="대여가능";
											response.render('equipment_detail', {
	                	                                                        	name:request.session.user.name,
	        	                	                                                result:resultDetail,
        	        	                	                                        equipmentID:equipmentID,
												rentalState:state,
												rental:1
                                                		                	});
										} else {
											sql="SELECT START_DATE, END_DATE FROM RENTAL_LOG WHERE EQUIPMENT_NUM=?;";
											connection.query(sql, equipmentID, function(err, result, fiedls){
												if(err) {
													connection.release();
													response.send('error : '+err);
												} else {
													connection.release();
													var start=result[0].START_DATE;
													var end=result[0].END_DATE;
													var now=moment().format('YYYY-MM-DD');
													if(moment(now).isBefore(end)) {
														var state="대여중";
														var day=moment(end).diff(moment(now), "days");	
													 	response.render('equipment_detail', {
                        	        	                                                                	name:request.session.user.name,
	        		        	                                                                        result:resultDetail,
		                                        	                                                        equipmentID:equipmentID,
															rentalState:state,
                        	                                		                                        rental:0,
															startday:start,
															returnday:end,
															day:day,
															overdue:false
														});
													} else {
														var state="연체중";
														var day=moment().diff(moment(end),"days");
														response.render('equipment_detail', {
                                                                                                                        name:request.session.user.name,
                                                                                                                        result:resultDetail,
                                                                                                                        equipmentID:equipmentID,
                                                                                                                        rentalState:state,
                                                                                                                        rental:0,
															startday:start,
															returnday:end,
															day:day,
															overdue:true
                                                                                                                });
													}
												}
											});
										}
									}
								});
							}
						});
					}
                                }
                        });
                });
        } else {
		response.redirect('/');
	}
});

app.get('/equipment/register', function(request, response){
	if(request.session.user) {
		response.render('equipment_register.ejs', {name:request.session.user.name});
	} else {
		response.redirect('/');
   	}
});
app.post('/equipment/registerProcess', function(request, response){
	if(request.session.user) {
		var body=request.body;
		var file=request.files.file;
		var no=0;
	
		pool.getConnection(function(err, connection){
			var sql="SELECT EQUIPMENT_NUM FROM EQUIPMENT_INFO WHERE EQUIPMENT_SERIAL=?;";
			connection.query(sql, [body.serial], function(err, result, fields){
				if(err) {
					connection.release();
					response.send('error : '+err);
				} else {
					if(result.length){
						connection.release();
						response.redirect('/equipment/main');
					} else {
						sql="SELECT count(*) AS count FROM EQUIPMENT_INFO;";
						connection.query(sql, function(err, result, fields){
							if(err) {
								connection.release();
								response.send('error : '+err);
							} else {
								no=result[0].count+1;
								file.mv(`./public/upload/${no}.png`, function(err){
									if(err) {
										connection.release();
										response.send('error : '+err);
									} else {
										var data={
                	        		        	                        'EQUIPMENT_NUM':no,
                        	                                        		'C_NUM':1,
		                	                                                'G_NUM':body.kind,
                		        	                                        'EQUIPMENT_NAME':body.name,
                                			                                'EQUIPMENT_SERIAL':body.serial,
                                                			                'PUBLISHER_NAME':body.brand,
                                                                			'PURCHASE_PRICE':body.price,
		                                                        	        'PURCHASE_DATE':body.date,
                		                                                	'EQUIPMENT_PICTURE':`./upload/${no}.png`,
	                                		                                'REMARK':body.remark
										};
										sql="INSERT INTO EQUIPMENT_INFO SET ?;";
										connection.query(sql, data, function(err, result, fields){
											if(err) {
												connection.rollback();
												connection.release();
												response.send('error : '+err);
											} else {
												request.session.qrcode={
													'equipment_num':no,
													'name':body.name
												};
												response.redirect("/equipment/registerResult");
											}
										});
										
                                                        		}

								});	
							}
						});
					}
				}	
			});
		});
	} else {
		response.redirect('/');
	}
});
app.get('/equipment/registerResult', function(request, response){
	if(request.session.user) {
		var qrcode=request.session.qrcode;
		request.session.qrcode=null;

		var URL=`http://49.50.172.95:80/equipment/detail/${qrcode.equipment_num}`;
		var opts={
			'type':'png'
		};
		QRCode.toFile(`./public/images/${qrcode.equipment_num}.png`, URL, opts, function(err, url){
			if(err) {
				response.send('error : '+err);
			} else {
				response.render('equipment_registerResult.ejs', {
					name:request.session.user.name,
					equipmentNum:qrcode.equipment_num,
					equipmentName:qrcode.name
				});
			}   
		});
	} else {
		response.redirect('/');
	}
});

app.post('/equipment/rental', function(request, response){
	if(request.session.user) {
		var equipmentID=request.body.equipmentID;
		var name=request.session.user.name;
		pool.getConnection(function(err, connection){
			var sql="SELECT count(*) AS count FROM USER_EQUIPMENT_MAPPING;";
			connection.query(sql, function(err, result, fields){
				if(err) {
					connection.release();
					response.send('error : '+err);
				} else {
					var no=result[0].count+1;
					sql="SELECT USER_NUM FROM USER_INFO WHERE USER_NAME=?;";
					connection.query(sql, [name], function(err, result, fields){
						if(err) {
							connection.release();
							response.send('error : '+err);
						} else {
							var user_num=result[0].USER_NUM;
							var data={
                                		                'MAPPING_NUM':no,
                                                		'USER_NUM':user_num,
		                                                'EQUIPMENT_NUM':parseInt(equipmentID)
		                                        };
                		                        sql="INSERT INTO USER_EQUIPMENT_MAPPING SET ?;";
							connection.query(sql, data, function(err, result, fields){
								if(err) {
									connection.rollback();
									connection.release();
									response.send('error : '+err);
								} else {
									connection.commit();
									sql="SELECT count(*) AS count FROM RENTAL_LOG;";
									connection.query(sql, function(err, result, fields){
										if(err) {
											connection.release();
											response.send('error : '+err);
										} else {
											no=result[0].count+1;
											var start=moment().format('YYYY-MM-DD');
											var end=moment().add(14, 'd').format('YYYY-MM-DD');
											data={
												'RENT_NUM':no,
												'C_NUM':1,
												'USER_NUM':user_num,
												'EQUIPMENT_NUM':equipmentID,
												'START_DATE':start,
												'END_DATE':end,
												'RETURN_DATE':'0'
											};
											sql="INSERT INTO RENTAL_LOG SET ?;";
											connection.query(sql, data, function(err, result, fields){
												if(err) {
													connection.rollback();
													connection.release();
													response.send('error : '+err);
												} else {
													connection.commit();
													connection.release();
													response.redirect(`/equipment/detail/${equipmentID}`);
												}
											});
										}
									});
								}								
							});
						}
					});
				}
			});
		});

	} else {
		response.redirect('/');
	}
});

module.exports = app;
var server=app.listen(app.get('port'), function(){
	console.log('Express server listening on port '+server.address().port);
});
