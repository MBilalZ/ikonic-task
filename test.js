import axios from "axios";

async function StartTest() {
  const requests = [];

  for (let i = 0; i < 100; i++) {
    let _id = i + 1;
    requests.push(
      axios.post("http://localhost:3000/produce", {
        id: _id,
        task_name: `Task ${_id}`,
      })
    );
  }

  // Use Promise.all to execute all requests in parallel
  try {
    const responses = await Promise.all(requests);

    // Process responses if needed
    responses.forEach((response, index) => {
      console.log(
        `Request ${index + 1} completed with status: ${response.status}`
      );
    });
  } catch (error) {
    // Handle errors if any of the requests fail
    console.error("Error in parallel requests:", error.message);
  }
}

// Call the function
StartTest();
