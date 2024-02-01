import express from "express";
import amqp from "amqplib";
import cluster from "cluster";
import dotenv from "dotenv";
dotenv.config();

if (cluster.isPrimary) {
  for (let i = 0; i < process.env.NO_OF_WORKERS; i++) {
    cluster.fork({ workerId: i + 1 });
  }
} else {
  const app = express();
  const queueName = "tasks";
  const resultQueueName = "results";
  const port = 8080;
  console.log(`Worker ${cluster.worker.id} started`);

  async function connectToRabbitMQ() {
    const rabbitMQUrl = "amqp://localhost";
    const connection = await amqp.connect(rabbitMQUrl);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName);
    await channel.assertQueue(resultQueueName);
    return channel;
  }

  async function processTask(task, channel) {
    if (task.workerId === cluster.worker.id) {
      console.log(
        `Worker ${cluster.worker.id} received task for processing:`,
        task
      );

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
        `Task processed by Worker ${cluster.worker.id}. Result sent to Supervisor`
      );
    } else {
      await channel.sendToQueue(queueName, Buffer.from(JSON.stringify(task)));
      console.log(
        `Task with ID ${task.id} is not for Worker ${cluster.worker.id}. Ignoring.`
      );
    }
  }

  async function simulateProcessing(task) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 10000); // Simulating a 10-second processing time
    });
  }

  async function startWorker() {
    try {
      const channel = await connectToRabbitMQ();
      channel.consume(queueName, async (msg) => {
        if (msg !== null) {
          const task = JSON.parse(msg.content.toString());
          console.log("Worker is processing task:", task);
          await processTask(task, channel);
          channel.ack(msg);
        }
      });
      console.log(
        `Worker ${cluster.worker.id} is listening to the RabbitMQ queue for tasks`
      );
    } catch (error) {
      console.error(
        `Error connecting to RabbitMQ in Worker ${cluster.worker.id}:`,
        error.message
      );
    }
  }
  startWorker();

  app.listen(port, () => {
    console.log(
      `Worker ${cluster.worker.id} listening at http://localhost:${port}`
    );
  });
}
