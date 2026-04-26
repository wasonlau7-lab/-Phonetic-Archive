const express = require("express")
const http = require("http")
const path = require("path")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const PORT = process.env.PORT || 3000
const publicPath = path.join(__dirname, "../public")

let controllerConnected = false

app.use(express.static(publicPath))

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"))
})

app.get("/controller", (req, res) => {
  res.sendFile(path.join(publicPath, "controller.html"))
})

io.on("connection", socket => {
  socket.emit("controller-status", {
    connected: controllerConnected
  })

  socket.on("controller-motion", data => {
    controllerConnected = true

    io.emit("controller-status", {
      connected: true
    })

    io.emit("motion-data", data)
  })

  socket.on("controller-ready", data => {
    controllerConnected = !!data.connected

    io.emit("controller-status", {
      connected: controllerConnected
    })
  })

  socket.on("main-ready", () => {
    socket.emit("controller-status", {
      connected: controllerConnected
    })
  })

  socket.on("disconnect", () => {})
})

server.listen(PORT, () => {
  console.log(`Phonetic Archive running on port ${PORT}`)
})