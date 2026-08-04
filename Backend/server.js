import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { setServers } from "node:dns/promises";
import memberModel from "./models/member.js";

setServers(["8.8.8.8", "1.1.1.1"]);

const URI =
  "mongodb+srv://mustafashahzad1947:admin123@batch18.dxy4t5s.mongodb.net/";
const PORT = 4000;

mongoose.connect(URI).then((res) => console.log(res));

// Server Create

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (request, response) => {
  response.json({
    message: "Server is successfully running...",
    body: null,
    status: true,
  });
});

app.post("/api/signup", async (request, response) => {

    const {fullName , email , password} = request.body

    if(!fullName , !email , !password){
response.json(
    {
        message : "Required fields are missing",
        status : false
    }
)
return
    }
    const passwordHash = bcrypt.hash(password , 10)
    console.log(passwordHash , "hash wala password");
    

    const obj = {
        ...request.body,

    }
    
  const userData = await memberModel.create(request.body);
  console.log(userData);

  console.log(request.body);

  response.json({
    message: "User Created",
  });

  
});

app.listen(PORT, () => console.log("Server running.."));