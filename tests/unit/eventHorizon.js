const { fromEvent } = require('rxjs')
const { map } = require('rxjs/operators')
const tape = require('tape')
const flat = require('flat')
const { tapeAssert, assertArraysMatch } = require('./utils')

const Tesseract = require('../../lib/tesseract')
const EventHorizon = require('../../lib/eventHorizon')

tape('EventHorizon / Resolver test', t => {

    let messagesDef = {
        id: 'messages',
        columns: [{
            name: 'id',
            columnType: 'number',
            primaryKey: true,
        }, {
            name: 'message',
            columnType: 'object',
        }, {
            name: 'status',
            columnType: 'number',
        }, {
            name: 'user'
        }]
    }

    let usersDef = {
        id: 'users',
        columns: [{
            name: 'id',
            columnType: 'number',
            primaryKey: true,
        }, {
            name: 'name',
            columnType: 'text',
        }]
    }

    let eventHorizon = new EventHorizon()
    let messages = eventHorizon.createTesseract('messages', messagesDef)
    let users = eventHorizon.createTesseract('users', usersDef)

    let session = eventHorizon.createSession({
        table: 'messages',
        filter: [{
            type: 'number',
            comparison: 'eq',
            field: 'status',
            value: 1
        }],
        sort: [{
            field: 'id',
            direction: 'DESC'
        }, {
            field: 'name',
            direction: 'ASC'
        }],
        groupBy: []
    })



    let updated$ = fromEvent(session, 'dataUpdate')
      .pipe(map(([d]) => d))

    let result = [{
        'addedIds': [1],
        'removedIds': []
    }, {
        'addedIds': [2],
        'removedIds': []
    }, {
        'addedIds': [3],
        'removedIds': []
    }, {
        'addedIds': [4],
        'removedIds': []
    }, {
        'updatedIds': [],
        'removedIds': [1]
    }, {
        'updatedIds': [2, 3],
        'removedIds': [4]
    }]

    tapeAssert(t, updated$, result.map(flat))
        .subscribe(r => { t.end() }, e => { console.trace(e) })

    users.add({id: 1, name: 'rafal'})
    users.add({id: 2, name: 'daniel'})
    users.add({id: 3, name: 'lauren'})
    
    messages.add({id: 1, user: 1, message: 'lorem', status: 1})
    messages.add({id: 2, user: 2, message: 'ipsum', status: 1})
    messages.add({id: 3, user: 3, message: 'dolor', status: 1})
    messages.add({id: 4, user: 1, message: 'orange', status: 1})

    messages.add({id: 5, user: 2, message: 'sit', status: 2})
    messages.add({id: 6, user: 3, message: 'amet', status: 2})

    messages.remove([1])

    messages.update([
        {id: 2, message: 'ipsum2', user: 2, status: 1},
        {id: 3, message: 'dolor2', user: 3, status: 1},
        {id: 4, message: 'orange', user: 1, status: 2}
    ])

    let dataResult = [ 
        { id: 2, name: 'daniel', msgCount: 2 },
        { id: 3, name: 'lauren' },
        { id: 1, name: 'rafal' } 
    ]

    var usersSession = eventHorizon.createSession({
        table: 'users',
        subSessions: {
            a: {
                table: 'messages',
                columns:  [{
                    name: 'user',
                    primaryKey: true,
                }, {
                    name: 'count',
                    value: 1,
                    aggregator: 'sum'
                }],
                filter: [{
                    type: 'custom',
                    value: 'user == 2',
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
            name: 'msgCount',
            resolve: {
                underlyingField: 'id',
                session: 'a',
                valueField: 'user',
                displayField: 'count'
            }
        }],
        sort: [  { field: 'name', direction: 'asc' }]
    })

    let data = usersSession.getLinq().select(x => x.object).toArray()

    assertArraysMatch(data, dataResult, e => t.fail(e), () => t.pass('Relational live query'))
})


tape('Live query aggregated data refresh after relation update test', t => {
  const eventHorizon = new EventHorizon()

  const people = eventHorizon.createTesseract('person', {
    id: 'person',
    columns: [{
      name: 'id',
      primaryKey: true,
    }, {
      name: 'name',
    }]
  })

  const messages = eventHorizon.createTesseract('message', {
    id: 'message',
    columns: [{
      name: 'id',
      primaryKey: true
    }, {
      name: 'personId',
    }, {
      name: 'status'
    }]
  })

  const session = eventHorizon.createSession({
    table: 'person',
    subSessions: {
      messageAggregator: {
        table: 'message',
        columns: [
          { name: 'personId', primaryKey: true },
          { name: 'status' },
          { name: 'count', value: 1, aggregator: 'sum' },
        ],
        groupBy: [{ dataIndex: 'personId' }],
        filter: [{ field: 'status', comparison: 'in', value: ['sent', 'delivered'] }]
      }
    },
    filter: [],
    columns: [
      { name: 'id', primaryKey: true },
      {
        name: 'numberOfMessages',
        resolve: {
          underlyingField: 'id',
          session: 'messageAggregator',
          childrenTable: 'message',
          displayField: 'count'
        }
      }
    ]
  })

  /****************
   * EXPECTATIONS *
   ****************/
  const expectedResult = [
    // After adding persons
    {
      addedIds: [ 1, 2, 3 ],
      addedData: [
        { id: 1, numberOfMessages: undefined },
        { id: 2, numberOfMessages: undefined },
        { id: 3, numberOfMessages: undefined }
      ],
      updatedIds: [],
      updatedData: [],
      removedIds: [],
      removedData: []
    },

    // After adding messages
    {
      addedIds: [],
      addedData: [],
      updatedIds: [ 1, 2, 3 ],
      updatedData: [
        { id: 1, numberOfMessages: 3 },
        { id: 2, numberOfMessages: 2 },
        { id: 3, numberOfMessages: 1 }
      ],
      removedIds: [],
      removedData: []
    },

    // After changing one of the messages status
    {
      addedIds: [],
      addedData: [],
      updatedIds: [ 3 ],
      updatedData: [
        { id: 3, numberOfMessages: undefined }
      ],
      removedIds: [],
      removedData: []
    }
  ]

  const updates$ = fromEvent(session, 'dataUpdate')
    .pipe(map(([d]) => d))

  tapeAssert(t, updates$, expectedResult.map(flat), 'Updates match', 300)
    .toPromise()
    .then(() => t.end())

  /************
   * SCENARIO *
   ************/
  people.add([
    { id: 1, name: 'Person #1' },
    { id: 2, name: 'Person #2' },
    { id: 3, name: 'Person #3' },
  ])

  messages.add([
    // Person #1 visible messages count 3
    { id: 1, personId: 1, status: 'delivered' },
    { id: 2, personId: 1, status: 'delivered' },
    { id: 3, personId: 1, status: 'sent' },
    { id: 4, personId: 1, status: 'deleted' },

    // Person #2 visible messages count 2
    { id: 5, personId: 2, status: 'delivered' },
    { id: 6, personId: 2, status: 'deleted' },
    { id: 7, personId: 2, status: 'sent' },

    // Person #1 visible messages count 1
    { id: 8, personId: 3, status: 'sent' },
  ])

  // Make person #3 visible messages count 0
  setTimeout(() => {
    messages.update([
      { id: 8, status: 'deleted' },
    ])
  }, 100)


})