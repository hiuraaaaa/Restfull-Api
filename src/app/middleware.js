import express from "express";
import logApiRequest from "../utils/logApiRequest.js";

export default function setupMiddleware(app) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(logApiRequest);
  app.use(express.static('public'));
}