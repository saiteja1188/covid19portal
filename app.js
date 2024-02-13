const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initailzeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initailzeDbAndServer()

const authorizationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'covid_india', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.post('/users/', async (request, response) => {
  const {username, password} = request.body
  const hashedPassword = await bcrypt.hash(password, 15)
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}' ;`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    const createUser = `INSERT INTO user(username, password) VALUES ("${username}", "${hashedPassword}");`
    await db.run(createUser)
    response.send('User create Successfuly')
  } else {
    response.status(400)
    response.send('User already exist')
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}' ;`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMath = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMath === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'covid_india')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// Returns a list of all states in the state table

app.get('/states/', authorizationToken, async (request, response) => {
  const selectStateList = `
  SELECT 
    state_id AS stateId,
    state_name AS stateName,
    population
  FROM 
    state;`
  const stateList = await db.all(selectStateList)
  response.send(stateList)
})

// Returns a state based on the state ID

app.get('/states/:stateId/', authorizationToken, async (request, response) => {
  const {stateId} = request.params
  const selectStateList = `
  SELECT 
    state_id AS stateId,
    state_name AS stateName,
    population
  FROM 
    state 
  WHERE 
    state_id = ${stateId};`
  const stateList = await db.get(selectStateList)
  response.send(stateList)
})

// Create a district in the district table, district_id is auto-incremented

app.post('/districts/', authorizationToken, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const createDistricts = `
  INSERT INTO 
    district (district_name, state_id, cases, cured, active, deaths)
  VALUES
    ("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
    ;`
  await db.run(createDistricts)
  response.send('District Successfully Added')
})

// Returns a district based on the district ID

app.get(
  '/districts/:districtId/',
  authorizationToken,
  async (request, response) => {
    const {districtId} = request.params
    const selectStateList = `
  SELECT 
    district_id  AS districtId,
    district_name AS districtName,
    state_id AS stateId,
    cases,
    cured,
    active,
    deaths
  FROM 
    district 
  WHERE 
    district_id = ${districtId};`
    const districtList = await db.get(selectStateList)
    response.send(districtList)
  },
)

// delete

app.delete(
  '/districts/:districtId/',
  authorizationToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrict = `DELETE FROM district WHERE district_id = ${districtId}`
    await db.run(deleteDistrict)
    response.send('District Removed')
  },
)

// Update district

app.put(
  '/districts/:districtId/',
  authorizationToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrict = `
    UPDATE 
      district 
    SET
      district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
    WHERE
      district_id = ${districtId};
    `
    await db.run(updateDistrict)
    response.send('District Details Updated')
  },
)

// Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  '/states/:stateId/stats/',
  authorizationToken,
  async (request, response) => {
    const {stateId} = request.params
    const {cases, cured, active, deaths} = request.body
    const totalDetails = `
  SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
  FROM
    district
  WHERE
    state_id = ${stateId};
  `
    const total = await db.get(totalDetails)
    response.send(total)
  },
)

module.exports = app;