const express = require("express")
const http = require("http")
const path = require("path")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const PORT = process.env.PORT || 3000
const publicPath = path.join(__dirname, "../public")

app.use(express.static(publicPath))

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"))
})

app.get("/controller", (req, res) => {
  res.sendFile(path.join(publicPath, "controller.html"))
})

io.on("connection", socket => {
  socket.on("controller-motion", data => {
    socket.broadcast.emit("motion-data", data)
  })

  socket.on("controller-ready", data => {
    socket.broadcast.emit("controller-status", data)
  })

  socket.on("main-ready", data => {
    socket.broadcast.emit("main-status", data)
  })

  socket.on("disconnect", () => {
    socket.broadcast.emit("controller-status", {
      connected: false
    })
  })
})

server.listen(PORT, () => {
  console.log(`Phonetic Archive running at http://localhost:${PORT}`)
  console.log(`Controller running at http://localhost:${PORT}/controller`)
})