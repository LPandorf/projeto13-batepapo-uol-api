import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";

dotenv.config();
const app=express();

app.use(cors());
app.use(express.json());

//conexão mongo
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
mongoClient.connect().then(()=>{
    db=mongoClient.db("batepapouol");
});

//formatos
const participantFormat=joi.object({
    name: joi.string().min(1).required(),
    laststatus: Date.now()
});
const messageFormat=joi.object({
    from: joi.string().required(),
    to: joi.string().min(1).required(),
    text: joi.string().min(1).required(),
    type: joi.string().valid("message", "private_message").required(),
    time: joi.string()
});

// /participants
app.post("/participants", async (req, res) => {
    const participant = req.body;
    const validation=participantFormat.validate(participant, {abortEarly: false});

    if(validation.error){
        const errors=validation.error.details.map((detail)=>detail.message);
        res.status(422).send(errors);
        return;
    }

    try{
        const participantExists=await db.collection("participants").findOne({name: participant.name});
        
        if(participantExists){
            res.sendStatus(409);
            return;
        }

        await db.collection("participants").insertOne({
            name: participant.name, 
            laststatus: Date.now()
        });
        await db.collection("messages").insertOne({
            from: participant.name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss")
        });
        res.sendStatus(201);
        
    }catch(error){
        res.status(500).send(error.message);
    }

});
app.get("/participants", async (req, res) => {
    try{
        const participants=await db.collection("participants").find().toArray();

        if(!participants){
            res.status(404).send("Ninguém foi encontrado");
            return;
        }
        res.send(participants);
    }catch(error){
        res.status(200).send(error.message);
    }
});

// /messages
app.post("/messages", async(req, res) => {

});

// /status

// remoção automática

app.listen(5000, ()=>console.log("Running"));