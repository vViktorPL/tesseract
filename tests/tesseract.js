var {mergeColumns} = require('../lib/utils')
var Tesseract = require('../lib/tesseract')
var EVH = new (require('../lib/eventHorizon'))({
    // commandPort: {
    //     host: 'exec', 
    //     port: 6789
    // }
})

var messages = EVH.createTesseract('messageQueue', {
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'message', 
    }, {
        name: 'status',
        aggregator: 'avg'
    }, {
        name: 'user',
    }, {
        name: 'deleted',
    }, {
        name: 'update',
        value: data =>  new Date(),
        aggregator: 'max'
    }]
})

var users = EVH.createTesseract('users', {
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'parentId',
    }, {
        name: 'expTest',
        expression: 'id/2'
    }, {
        name: 'name',
    }]
})

var union = EVH.createUnion('pierdzielec', {
    subSessions:{
        a: {
            table: 'messageQueue',
            columns: [{
                name: 'id',
                primaryKey: true,
            }, {
                name: 'type',
                value: 'message'
            }, {
                name: 'message',
            }, {
                name: 'user',
            }, {
                name: 'parentId',
                value: x => `${x.user}/undefined`
            }, {
                name: 'userName',
                resolve: {
                    childrenTable: 'users',
                    underlyingField: 'user',
                    displayField: 'name'
                }
            }]
        },
        b: {
            table: 'users',
            columns: [{
                name: 'id',
                primaryKey: true,
            }, {
                name: 'type',
                value: 'user'
            }, {
                name: 'user',
                value: x=>x.id
            }, {
                name: 'name',
            }, {
                name: 'parentId',
                value: (x, y, underlyingValue) => `${underlyingValue}/undefined`
            }, {
                name: 'userName',
                value: x => x.name
            }]
        }
    },
    columns: [{
        name: 'userName',
    }, {
        name: 'message',
    }, {
        name: 'user',
    }, {
        name: 'type',
    }, {
        name: 'id',
        value: x => `${x.user}/${x.message}`,
        primaryKey: true,
    }, {
        name: 'parentId',
    }]
})

var usersSession = EVH.createSession({
    table: 'users',
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'name',
    }, {
        name: 'msgCount',
        resolve: {
            underlyingField: 'id',
            session: {
                table: 'messageQueue',
                columns:  [{
                    name: 'user',
                    primaryKey: true,
                }, {
                    name: 'count',
                    value: 1,
                    aggregator: 'sum'
                }, {
                    name: 'min',
                    value: 1,
                    aggregator: 'min'
                }],
                // filter: [{
                //     type: 'custom',
                //     value: 'user == 2',
                // }],
                groupBy: [{ dataIndex: 'user' }]
            },
            valueField: 'user',
            displayField: 'count'
        }
    }],
    filter: [{
        type: 'custom',
        value: 'msgCount > 1',
    }],
    sort: [  { field: 'name', direction: 'asc' }]
})

EVH.createSession({
    id:'liveQuery',
    table: 'users',
    subSessions: {
        a: {
            table: 'messageQueue',
            columns:  [{
                name: 'user',
                primaryKey: true,
            }, {
                name: 'deleted'
            }, {
                name: 'count',
                value: 1,
                aggregator: 'sum'
            }, {
                name: 'min',
                value: 1,
                aggregator: 'min'
            }],
            filter: [{
                field: 'deleted',
                comparison: 'eq',
                value: false,
            }],
            groupBy: [{ dataIndex: 'user' }]
        }
    },
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'name',
    }, {
        name: 'expTest',
    }, {
        name: 'msgCount',
        resolve: {
            underlyingField: 'id',
            session: 'a',
            displayField: 'count'
        }
    }, {
        name: 'msgMin',
        resolve: {
            underlyingField: 'id',
            session: 'a',
            displayField: 'min'
        }
    },{
        name: 'halfCount',
        expression: 'msgCount/3'
    },{
        name: 'fullName',
        value: '${name}-${id}'
    }],
    // filter: [{
    //     field: 'msgCount',
    //     comparison: 'eq',
    //     value: 1,
    // }],
    sort: [  { field: 'name', direction: 'asc' }]
})
var usersSession2 = EVH.createSession({
    id: 'liveQuery'
})

var usersSession = EVH.createSession({
    table: 'users'
})

var messageSession = EVH.createSession({
    table: 'messageQueue',
    columns:  [{
        name: 'id',
    }, {
        name: 'user',
    },{
        name: 'deleted',
        defaultValue: false
    }, {
        name: 'message',
    }],
    filter: [{
        field: 'deleted',
        //type: 'boolean',
        comparison: '==',
        value: false
    }],
    sort: [  { field: 'status', direction: 'desc' }],
    // immediateUpdate: true
})

// usersSession2.on('dataUpdate', (x)=>{console.log('usersSession2 updates', x.toJSON())})
// messageSession.on('dataUpdate', (x)=>{console.log('messageSession updates', x.toJSON())})


var ii = 1

users.add({id: 1, parentId: 1, name: 'rafal'})
users.add({id: 2, parentId: 1, name: 'daniel'})
users.add({id: 3, parentId: 1, name: 'lauren'})


messages.add({id: ii++, message: 'dupa', user: 3, status: 1, deleted: false})
messages.add({id: ii++, message: 'cipa', user: 1, status: 1, deleted: false})
messages.add({id: ii++, message: 'bla', user: 3, status: 2, deleted: false})
messages.add({id: ii++, message: 'bla2', user: 2, status: 2, deleted: false})
messages.add({id: ii++, message: 'bla3', user: 2, status: 2, deleted: false})

messages.update({id: 2, message: 'cipa2', status: 2})

// setTimeout(()=>{
//     messages.update({id: 5, message: 'pierdol sie dupo jedna', status: 1, deleted: true})
//     usersSession2.columns[5].value = '${id}-${name}'
//     usersSession2.updateColumns(usersSession2.columns)
// }, 1000)
// setTimeout(()=>{
//     messages.update({id: 4, deleted: true})
// }, 2000)

// console.log(messages.getById(1).userName)
// console.time('perf')
// while(ii++ < 2000000){
//     if(ii%100000 === 0) 
//         console.log(ii)
//         messages.update([[ii, 'jdoijs oifcj nds;of', 2, Math.ceil(Math.random()*3), false]])
// }
// console.timeEnd('perf')


setTimeout(() => {
    // console.log(usersSession.getData().map(x=>x.object))
    console.log('usersSession2', usersSession2.getData().map(x=>x.object))
    // console.log('messageSession',messageSession.getData().map(x=>x.object))
    // console.log('users', usersSession.returnTree(1, 'parentId'))
    // console.log('Union from 2 sessions', JSON.stringify(union.returnTree('1/undefined', 'parentId'), null, 2))
}, 300)
setTimeout(()=>{}, 1000000)