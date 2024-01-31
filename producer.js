// producer.js
const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid"); // Import UUID module

const app = express();
const port = 3000;
const supervisorEndpoint = "http://localhost:3001/supervise";

app.use(express.json());

app.post("/produce", async (req, res) => {
  const data = req.body;

  // Generate a unique task ID using UUID
  const id = uuidv4();

  // Include the task ID in the task data
  const task = {
    id,
    ...data,
  };

  console.log("Producer received data:", task);

  try {
    await axios.post(supervisorEndpoint, task);
    console.log("Task sent to Supervisor for distribution");
    res.json({
      message: "Task sent to Supervisor for distribution",
      task,
    });
  } catch (error) {
    console.error("Error sending task to Supervisor:", error.message);
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Producer listening at http://localhost:${port}`);
});
