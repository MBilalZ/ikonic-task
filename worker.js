// worker.js
const express = require("express");
const amqp = require("amqplib");

const app = express();
let port = 5000;
const queueName = "tasks";

let workerId; // Worker ID for this instance

// Worker ID is received as a command line argument
process.argv.forEach((val, index) => {
  if (index > 1) {
    workerId = parseInt(val);
    port = 5000 + workerId;
    startWorker();
  }
});

async function connectToRabbitMQ() {
  const rabbitMQUrl = "amqp://localhost"; // Change this based on your RabbitMQ server configuration
  const connection = await amqp.connect(rabbitMQUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName);
  return channel;
}

async function processTask(task) {
  if (task.workerId === workerId) {
    console.log(`Worker ${workerId} received task for processing:`, task);
    // Perform processing here
    console.log(`Task processed by Worker ${workerId}`);
  } else {
    console.log(
      `Task with ID ${task.id} is not for Worker ${workerId}. Ignoring.`
    );
  }
}

async function startWorker() {
  try {
    const channel = await connectToRabbitMQ();
    channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        const task = JSON.parse(msg.content.toString());
        await processTask(task);
        channel.ack(msg);
      }
    });
    console.log(
      `Worker ${workerId} is listening to the RabbitMQ queue for tasks`
    );
  } catch (error) {
    console.error(
      `Error connecting to RabbitMQ in Worker ${workerId}:`,
      error.message
    );
  }
}

app.listen(port, () => {
  console.log(`Worker ${workerId} listening at http://localhost:${port}`);
});
