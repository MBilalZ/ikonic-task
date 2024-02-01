import express from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const app = express();
const port = 3000;
const supervisorEndpoint = "http://localhost:3001/supervise";

app.use(express.json());

app.post("/produce", async (req, res) => {
  const data = req.body;


  console.log("Producer received data:", data);

  try {
    await axios.post(supervisorEndpoint, data);
    console.log("Task sent to Supervisor for distribution");
    res.json({
      message: "Task sent to Supervisor for distribution",
      data,
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
