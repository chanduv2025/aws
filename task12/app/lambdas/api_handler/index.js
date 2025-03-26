import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";

// Initialize AWS services
const dynamoDBClient = new AWS.DynamoDB.DocumentClient();
const cognitoService = new AWS.CognitoIdentityServiceProvider();

// Retrieve configuration from environment variables
const USER_POOL_IDENTIFIER = process.env.cup_id;
const CLIENT_IDENTIFIER = process.env.cup_client_id;
const TABLES_STORAGE = process.env.tables_table;
const RESERVATIONS_STORAGE = process.env.reservations_table;

// Main Lambda function handler
export const handler = async (event, context) => {
  console.log(
    "Event Details:",
    JSON.stringify({
      path: event.path,
      method: event.httpMethod,
      authHeader: event.headers?.Authorization,
      requestBody: event.body,
    })
  );
  try {
    const { resource: path, httpMethod } = event;
    const apiRoutes = {
      "POST /signup": processSignup,
      "POST /signin": processSignin,
      "GET /tables": fetchTables,
      "POST /tables": createTableEntry,
      "GET /tables/{tableId}": fetchTableById,
      "GET /reservations": fetchReservations,
      "POST /reservations": createReservationEntry,
    };
    const requestKey = `${httpMethod} ${path}`;
    const response = apiRoutes[requestKey]
      ? await apiRoutes[requestKey](event)
      : {
          statusCode: 404,
          headers: generateCorsHeaders(),
          body: JSON.stringify({ message: "Endpoint Not Found" }),
        };
    return response;
  } catch (error) {
    console.error("Processing Error:", error);
    return {
      statusCode: 500,
      headers: generateCorsHeaders(),
      body: JSON.stringify({
        message: "Server encountered an issue.",
        error: error.message,
      }),
    };
  }
};

// Function to generate CORS headers for API responses
function generateCorsHeaders() {
  return {
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Accept-Version": "*",
  };
}

// Function to format API responses
function constructResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: generateCorsHeaders(),
    body: JSON.stringify(body),
  };
}

// Signup Handler
async function processSignup(event) {
  try {
    const { firstName, lastName, email, password } = JSON.parse(event.body);
    if (!firstName || !lastName || !email || !password) {
      return constructResponse(400, { error: "All fields are mandatory." });
    }
    if (!/^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return constructResponse(400, { error: "Invalid email format." });
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[$%^*-_])[A-Za-z\d$%^*-_]{12,}$/.test(password)) {
      return constructResponse(400, { error: "Weak password format." });
    }
    await cognitoService
      .adminCreateUser({
        UserPoolId: USER_POOL_IDENTIFIER,
        Username: email,
        UserAttributes: [
          { Name: "given_name", Value: firstName },
          { Name: "family_name", Value: lastName },
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
        ],
        TemporaryPassword: password,
        MessageAction: "SUPPRESS",
      })
      .promise();
    await cognitoService
      .adminSetUserPassword({
        UserPoolId: USER_POOL_IDENTIFIER,
        Username: email,
        Password: password,
        Permanent: true,
      })
      .promise();
    return constructResponse(200, { message: "User registered successfully." });
  } catch (error) {
    console.error("Signup Error:", error);
    if (error.code === "UsernameExistsException") {
      return constructResponse(400, { error: "Email is already registered." });
    }
    return constructResponse(502, { error: "Signup operation failed." });
  }
}


// Handler for user sign-in
async function processUserSignin(event) {
  try {
    // Extract email and password from the event body
    const { emailAddress, userPassword } = JSON.parse(event.body);
    console.log("Processing sign-in request for:", emailAddress);
    
    // Parameters for authentication request
    const authParams = {
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: emailAddress,
        PASSWORD: userPassword,
      },
    };
    
    // Initiate authentication with Cognito
    const authOutcome = await cognito.adminInitiateAuth(authParams).promise();
    console.log("Authentication Outcome:", JSON.stringify(authOutcome));
    
    // Validate authentication result
    if (!authOutcome.AuthenticationResult) {
      console.error("Missing AuthenticationResult in response.");
      return formatResponse(400, {
        error: "Authentication failed. Please try again.",
      });
    }
    
    // Return successful authentication response
    return formatResponse(200, {
      idToken: authOutcome.AuthenticationResult.IdToken,
    });
  } catch (err) {
    console.error("Sign-in process encountered an error:", err);
    
    if (err.code === "NotAuthorizedException") {
      return formatResponse(400, { error: "Incorrect email or password." });
    }
    return formatResponse(400, { error: "Sign-in failed." });
  }
}

// Handler to retrieve tables
async function fetchTables(event) {
  const currentUser = getUsernameFromToken(event);
  if (!currentUser) {
    return formatResponse(401, { message: "Access denied" });
  }
  
  const queryParams = {
    TableName: TABLES_TABLE,
  };
  try {
    const queryResult = await dynamodb.scan(queryParams).promise();
    const availableTables = queryResult.Items.map((tbl) => ({
      id: Number(tbl.id),
      number: tbl.number,
      places: tbl.places,
      isVip: tbl.isVip,
      minOrder: tbl.minOrder || 0,
    }));
    
    return formatResponse(200, { tables: availableTables });
  } catch (err) {
    console.error("Error retrieving tables:", err);
    return formatResponse(500, { message: "Server error occurred." });
  }
}

// Handler to create a new table
async function registerTable(event) {
  const currentUser = getUsernameFromToken(event);
  if (!currentUser) {
    return formatResponse(401, { message: "Access denied" });
  }
  
  const newTable = JSON.parse(event.body);
  
  // Validate table properties
  if (
    typeof newTable.number !== "number" ||
    typeof newTable.places !== "number" ||
    typeof newTable.isVip !== "boolean"
  ) {
    return formatResponse(400, {
      message: "Table number, capacity, and VIP status are required fields.",
    });
  }
  
  let tableIdentifier = newTable.id || uuidv4();
  const tableRecord = {
    id: String(tableIdentifier),
    number: newTable.number,
    places: newTable.places,
    isVip: newTable.isVip,
    minOrder: newTable.minOrder ?? 0,
  };
  
  const saveParams = {
    TableName: TABLES_TABLE,
    Item: tableRecord,
  };
  
  await dynamodb.put(saveParams).promise();
  return formatResponse(200, { id: tableIdentifier });
}

// Handler to retrieve table details by ID
async function fetchTableDetails(event) {
  const currentUser = getUsernameFromToken(event);
  if (!currentUser) {
    return formatResponse(401, { message: "Access denied" });
  }
  
  const tableIdentifier = event.pathParameters.tableId;
  const queryParams = {
    TableName: TABLES_TABLE,
    Key: { id: tableIdentifier },
  };
  
  try {
    const queryResult = await dynamodb.get(queryParams).promise();
    
    if (!queryResult.Item) {
      return formatResponse(404, { message: "Table not found." });
    }
    
    const tableDetails = {
      id: Number(queryResult.Item.id),
      number: queryResult.Item.number,
      places: queryResult.Item.places,
      isVip: queryResult.Item.isVip,
      minOrder: queryResult.Item.minOrder || 0,
    };
    
    return formatResponse(200, tableDetails);
  } catch (err) {
    console.error("Error fetching table details:", err);
    return formatResponse(500, { message: "Server error occurred." });
  }
}


// Function to fetch reservations
async function fetchReservations(event) {
  // Extract username from authentication token
  const userIdentifier = getUsernameFromToken(event);
  if (!userIdentifier) {
    return formatResponse(401, { message: "Unauthorized access" });
  }
  
  // Retrieve query parameters
  const queryParameters = event.queryStringParameters || {};
  let scanParameters = {
    TableName: BOOKINGS_TABLE,
  };
  
  // Filter reservations based on user
  if (queryParameters.user) {
    scanParameters.FilterExpression = "userIdentifier = :userIdentifier";
    scanParameters.ExpressionAttributeValues = {
      ":userIdentifier": queryParameters.user,
    };
  }
  
  // Fetch reservations from database
  const queryResult = await dynamodb.scan(scanParameters).promise();
  const formattedReservations = queryResult.Items.map((record) => ({
    tableId: record.tableId,
    customerName: record.customerName,
    contactNumber: record.contactNumber,
    bookingDate: record.bookingDate,
    startTime: record.startTime,
    endTime: record.endTime,
  }));
  
  return formatResponse(200, {
    reservations: formattedReservations,
  });
}

// Function to create a new reservation
async function createReservation(event) {
  try {
    // Extract username for authentication
    const userIdentifier = getUsernameFromToken(event);
    if (!userIdentifier) {
      return formatResponse(401, { message: "Unauthorized access" });
    }
    
    // Parse request body
    const requestData = JSON.parse(event.body);
    console.log(requestData);
    const { tableId, customerName, contactNumber, bookingDate, startTime, endTime } = requestData;
    
    // Validate required fields
    if (!tableId || !bookingDate || !startTime || !endTime) {
      return formatResponse(400, {
        message: "Table ID, date, start time, and end time are required",
      });
    }
    
    // Check if the table exists
    const tableQuery = {
      TableName: TABLES_DATABASE,
      FilterExpression: "#tableId = :tableId",
      ExpressionAttributeNames: {
        "#tableId": "id",
      },
      ExpressionAttributeValues: {
        ":tableId": tableId,
      },
    };
    const tableResponse = await dynamodb.scan(tableQuery).promise();
    if (tableResponse.Items.length === 0) {
      return formatResponse(400, { message: "Specified table does not exist" });
    }
    
    const selectedTable = tableResponse.Items[0];
    
    // Check for existing reservations
    const reservationConflictCheck = {
      TableName: BOOKINGS_TABLE,
      FilterExpression:
        "tableId = :tableId AND #bookingDate = :bookingDate AND (#startTime BETWEEN :start AND :end OR :start BETWEEN #startTime AND endTime)",
      ExpressionAttributeNames: {
        "#bookingDate": "bookingDate",
        "#startTime": "startTime",
      },
      ExpressionAttributeValues: {
        ":tableId": tableId,
        ":bookingDate": bookingDate,
        ":start": startTime,
        ":end": endTime,
      },
    };
    const existingBookings = await dynamodb.scan(reservationConflictCheck).promise();
    if (existingBookings.Items.length > 0) {
      return formatResponse(400, {
        message: "Table is already booked for the selected time slot",
      });
    }
    
    // Create reservation entry
    const newBooking = {
      id: uuidv4(),
      tableId: selectedTable.id,
      tableNumber: selectedTable.number,
      customerName: customerName,
      contactNumber: contactNumber,
      userIdentifier: userIdentifier,
      bookingDate: bookingDate,
      startTime: startTime,
      endTime: endTime,
      createdTimestamp: new Date().toISOString(),
    };
    
    const bookingParams = {
      TableName: BOOKINGS_TABLE,
      Item: newBooking,
    };
    await dynamodb.put(bookingParams).promise();
    
    return formatResponse(200, {
      reservationId: newBooking.id,
      message: "Reservation successfully created",
    });
  } catch (error) {
    return formatResponse(500, { message: "Server encountered an error" });
  }
}


// Helper function to extract user identifier from token
function extractUserIdentifier(event) {
  try {
    if (
      event.requestContext &&
      event.requestContext.authorizer &&
      event.requestContext.authorizer.claims
    ) {
      const userIdentifier =
        event.requestContext.authorizer.claims["cognito:username"];
      return userIdentifier;
    }
    if (event.headers && event.headers.Authorization) {
      console.log(
        "Authorization header detected, but not processed via requestContext.authorizer"
      );
    }
    return null;
  } catch (error) {
    console.error("Error extracting user identifier from token:", error);
    return null;
  }
}