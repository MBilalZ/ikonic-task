import express from "express";
import amqp from "amqplib";

const app = express();
let port = 5000;
const queueName = "tasks";
const resultQueueName = "results";

let workerId;
let channel;
process.argv.forEach((val, index) => {
  if (index > 1) {
    workerId = parseInt(val);
    port = 5000 + workerId;
    startWorker();
  }
});

async function connectToRabbitMQ() {
  if (!channel) {
    const rabbitMQUrl = "amqp://localhost";
    const connection = await amqp.connect(rabbitMQUrl);
    channel = await connection.createChannel();
    await channel.assertQueue(queueName);
    await channel.assertQueue(resultQueueName);
  }
  return channel;
}

async function processTask(task, channel) {
  if (task.workerId === workerId) {
    console.log(`Worker ${workerId} received task for processing:`, task);

    await simulateProcessing(task);

    const result = {
      taskId: task.id,
      result: "Processing complete",
    };
    await channel.sendToQueue(
      resultQueueName,
      Buffer.from(JSON.stringify(result))
    );

    console.log(
      `Task processed by Worker ${workerId}. Result sent to Supervisor`
    );
  } else {
    console.log(
      `Task with ID ${task.id} is not for Worker ${workerId}. Ignoring.`
    );
  }
}

async function simulateProcessing(task) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 5000); // Simulating a 5-second processing time
  });
}

async function startWorker() {
  try {
    const channel = await connectToRabbitMQ();
    channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        const task = JSON.parse(msg.content.toString());
        await processTask(task, channel);
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
