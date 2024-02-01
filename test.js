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

  try {
    const responses = await Promise.all(requests);

    responses.forEach((response, index) => {
      console.log(
        `Request ${index + 1} completed with status: ${response.status}`
      );
    });
  } catch (error) {
    console.error("Error in parallel requests:", error.message);
  }
}

// Call the function
StartTest();
