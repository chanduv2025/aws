import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Initialize AWS services
const dynamoDBClient = new AWS.DynamoDB.DocumentClient();
const cognitoService = new AWS.CognitoIdentityServiceProvider();

// Fetch configuration values from environment variables
const USER_POOL_IDENTIFIER = process.env.cup_id;
const APP_CLIENT_IDENTIFIER = process.env.cup_client_id;
const TABLES_DB_NAME = process.env.tables_table;
const RESERVATIONS_DB_NAME = process.env.reservations_table;

// Main handler function for processing requests
export const handler = async (event, context) => {
  console.log("Incoming Event:", JSON.stringify({
    path: event.path,
    method: event.httpMethod,
    authHeader: event.headers?.Authorization,
    requestBody: event.body
  }));

  try {
    const { resource: routePath, httpMethod: requestMethod } = event;
    const apiRoutes = {
      "POST /signup": processSignup,
      "POST /signin": processSignin,
      "GET /tables": fetchTables,
      "POST /tables": createNewTable,
      "GET /tables/{tableId}": fetchTableById,
      "GET /reservations": fetchReservations,
      "POST /reservations": createNewReservation,
    };

    const currentRoute = `${requestMethod} ${routePath}`;
    const apiResponse = apiRoutes[currentRoute]
      ? await apiRoutes[currentRoute](event)
      : {
          statusCode: 404,
          headers: generateCorsHeaders(),
          body: JSON.stringify({ message: "Endpoint not found" }),
        };

    return apiResponse;
  } catch (error) {
    console.error("Request Handling Error:", error);
    return {
      statusCode: 500,
      headers: generateCorsHeaders(),
      body: JSON.stringify({
        message: "Internal Server Error",
        errorDetail: error.message,
      }),
    };
  }
};

// Function to generate CORS headers
function generateCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    'Content-Type': 'application/json'
  };
}

// Helper function to format API responses
function createApiResponse(statusCode, responseBody) {
  return {
    statusCode: statusCode,
    headers: generateCorsHeaders(),
    body: JSON.stringify(responseBody)
  };
}

// Handler for user signup
async function processSignup(event) {
  try {
    const { firstName, lastName, email, password } = JSON.parse(event.body);

    if (!firstName || !lastName || !email || !password) {
      return createApiResponse(400, { error: "All input fields are mandatory." });
    }

    // Validate email format
    if (!/^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return createApiResponse(400, { error: "Invalid email format." });
    }

    // Validate password complexity
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[$%^*-_])[A-Za-z\d$%^*-_]{12,}$/.test(password)) {
      return createApiResponse(400, { error: "Password does not meet security requirements." });
    }

    // Create user in Cognito
    await cognitoService.adminCreateUser({
      UserPoolId: USER_POOL_IDENTIFIER,
      Username: email,
      UserAttributes: [
        { Name: "given_name", Value: firstName },
        { Name: "family_name", Value: lastName },
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" }
      ],
      TemporaryPassword: password,
      MessageAction: "SUPPRESS",
    }).promise();

    // Set permanent password
    await cognitoService.adminSetUserPassword({
      UserPoolId: USER_POOL_IDENTIFIER,
      Username: email,
      Password: password,
      Permanent: true
    }).promise();

    return createApiResponse(200, { message: "User registered successfully." });
  } catch (error) {
    console.error("Signup Process Error:", error);

    if (error.code === "UsernameExistsException") {
      return createApiResponse(400, { error: "This email is already in use." });
    }

    return createApiResponse(502, { error: "Signup process failed." });
  }
}

// SignIn handler
async function processSignIn(event) {
  try {
    const { userEmail, userPassword } = JSON.parse(event.body); // Extract user credentials

    const authParams = {
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: userEmail, // Email is used as the username
        PASSWORD: userPassword
      }
    };

    const authOutcome = await cognito.adminInitiateAuth(authParams).promise();

    // Ensure AuthenticationResult is defined before proceeding
    if (!authOutcome.AuthenticationResult) {
      return formatResponse(400, { error: "Authentication failed. Try again." });
    }

    return formatResponse(200, {
      idToken: authOutcome.AuthenticationResult.IdToken
    });
  } catch (error) {
    // Handle incorrect credentials (Cognito does NOT differentiate between wrong passwords & non-existent users)
    if (error.code === "NotAuthorizedException") {
      return formatResponse(400, { error: "Invalid email or password." });
    }

    return formatResponse(400, { error: "Authentication failed." });
  }
}

// Fetch Table List
async function retrieveTables(event) {
  const currentUser = getUsernameFromToken(event); // Get username from token
  if (!currentUser) {
    return formatResponse(401, { message: "Unauthorized" });
  }

  const scanParams = {
    TableName: TABLES_TABLE,
  };

  try {
    const scanResult = await dynamodb.scan(scanParams).promise();

    // Transform database response into a structured table list
    const tableList = scanResult.Items.map((tableItem) => ({
      id: Number(tableItem.id),
      number: tableItem.number,
      places: tableItem.places,
      isVip: tableItem.isVip,
      minOrder: tableItem.minOrder || 0,
    }));

    return formatResponse(200, { tables: tableList });
  } catch (error) {
    console.error("Error fetching tables:", error);
    return formatResponse(500, { message: "Internal Server Error" });
  }
}

// Add a New Table
async function addTable(event) {
  const currentUser = getUsernameFromToken(event); // Validate user authorization
  if (!currentUser) {
    return formatResponse(401, { message: 'Unauthorized' });
  }

  const newTable = JSON.parse(event.body);

  // Validate input data types
  if (typeof newTable.number !== "number" ||
    typeof newTable.places !== "number" ||
    typeof newTable.isVip !== "boolean") {
    return formatResponse(400, {
      message: 'Table number, capacity, and VIP status are required'
    });
  }

  let tableId = newTable.id || uuidv4(); // Generate unique ID if not provided

  const tableEntry = {
    id: String(tableId),
    number: newTable.number,
    places: newTable.places,
    isVip: newTable.isVip,
    minOrder: newTable.minOrder ?? 0,
  };

  const putParams = {
    TableName: TABLES_TABLE,
    Item: tableEntry
  };

  await dynamodb.put(putParams).promise(); // Save table data to the database

  return formatResponse(200, { id: tableId });
}

// Retrieve Table details by its ID
async function fetchTableDetails(event) {
  const user = extractUsernameFromToken(event);
  if (!user) {
    return formatResponse(401, { message: "Access Denied" });
  }

  const requestedTableId = event.pathParameters.tableId;
  const dbParams = {
    TableName: TABLES_TABLE,
    Key: { id: requestedTableId },
  };

  try {
    const dbResponse = await dynamodb.get(dbParams).promise();

    if (!dbResponse.Item) {
      return formatResponse(404, { message: "Table not found" });
    }

    const tableDetails = {
      id: Number(dbResponse.Item.id),
      number: dbResponse.Item.number,
      seats: dbResponse.Item.places,
      vipStatus: dbResponse.Item.isVip,
      minimumOrder: dbResponse.Item.minOrder || 0,
    };

    return formatResponse(200, tableDetails);
  } catch (err) {
    console.error("Error retrieving table information:", err);
    return formatResponse(500, { message: "Server Error" });
  }
}

// Fetch Reservation details
async function fetchReservations(event) {
  const user = extractUsernameFromToken(event);
  if (!user) {
    return formatResponse(401, { message: "Access Denied" });
  }

  const filters = event.queryStringParameters || {};
  let queryParams = {
    TableName: RESERVATIONS_TABLE,
  };

  if (filters.user) {
    queryParams.FilterExpression = "username = :username";
    queryParams.ExpressionAttributeValues = {
      ":username": filters.user,
    };
  }

  const scanResult = await dynamodb.scan(queryParams).promise();

  const formattedReservations = scanResult.Items.map(entry => ({
    tableNo: entry.tableNumber,
    customerName: entry.clientName,
    contactNumber: entry.phoneNumber,
    reservationDate: entry.date,
    startTime: entry.time,
    endTime: entry.slotTimeEnd,
  }));

  return formatResponse(200, {
    reservations: formattedReservations,
  });
}

// Add a new reservation
async function createReservation(event) {
  try {
    const user = extractUserFromToken(event);
    if (!user) {
      return formatResponse(401, { message: 'Access Denied' });
    }

    const requestData = JSON.parse(event.body);
    console.log(requestData);

    const { tableNumber, clientName, phoneNumber, date, slotTimeStart, slotTimeEnd } = requestData;

    if (!tableNumber || !date || !slotTimeStart || !slotTimeEnd) {
      return formatResponse(400, {
        message: 'Table number, date, slotTimeStart, and slotTimeEnd are required'
      });
    }

    const searchTableParams = {
      TableName: TABLES_TABLE,
      FilterExpression: "#num = :tableNumber",
      ExpressionAttributeNames: {
        "#num": "number"
      },
      ExpressionAttributeValues: {
        ":tableNumber": tableNumber
      }
    };

    const tableQueryResult = await dynamodb.scan(searchTableParams).promise();

    if (tableQueryResult.Items.length === 0) {
      return formatResponse(400, { message: 'Table not found' });
    }

    const selectedTable = tableQueryResult.Items[0];
    const tableId = selectedTable.id;

    const reservationConflictParams = {
      TableName: RESERVATIONS_TABLE,
      FilterExpression: "tableId = :tableId AND #date = :date AND (#time BETWEEN :start AND :end OR :start BETWEEN #time AND slotTimeEnd)",
      ExpressionAttributeNames: {
        "#date": "date",
        "#time": "time"
      },
      ExpressionAttributeValues: {
        ":tableId": tableId,
        ":date": date,
        ":start": slotTimeStart,
        ":end": slotTimeEnd
      }
    };

    const existingBookings = await dynamodb.scan(reservationConflictParams).promise();

    if (existingBookings.Items.length > 0) {
      return formatResponse(400, {
        message: 'This table is already booked for the selected time slot'
      });
    }

    const newReservation = {
      id: uuidv4(),
      tableId: tableId,
      tableNumber: selectedTable.number,
      clientName: clientName,
      phoneNumber: phoneNumber,
      username: user,
      date: date,
      time: slotTimeStart,
      slotTimeEnd: slotTimeEnd,
      createdAt: new Date().toISOString()
    };

    const saveReservationParams = {
      TableName: RESERVATIONS_TABLE,
      Item: newReservation
    };

    await dynamodb.put(saveReservationParams).promise();

    return formatResponse(200, {
      reservationId: newReservation.id,
      message: 'Reservation successfully created'
    });
  } catch (error) {
    return formatResponse(500, { message: "Server Error" });
  }
}

// Utility function to get username from token
function extractUserFromToken(event) {
  try {
    if (event.requestContext && event.requestContext.authorizer &&
      event.requestContext.authorizer.claims) {
      const user = event.requestContext.authorizer.claims['cognito:username'];
      return user;
    }

    if (event.headers && event.headers.Authorization) {
      console.log('Authorization header detected, but not processed through authorizer');
    }

    return null;
  } catch (error) {
    console.error('Error extracting user from token:', error);
    return null;
  }
}
