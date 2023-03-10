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
    db=mongoClient.db();
});

//formatos
const messageFormat=joi.object({
    to: joi.string().min(1).required(),
    text: joi.string().min(1).required(),
    type: joi.string().valid("message", "private_message").required(),
});

// /participants
app.post("/participants", async (req, res) => {
    const participant = req.body;
    const participantFormat=joi.object({
        name: joi.string().min(1).required(),
    });
    const validation=participantFormat.validate(participant, {abortEarly: false});

    if(validation.error){
        const errors= validation.error.details.map((detail)=> detail.message);
        res.status(422).send(errors);
        return;
    }

    try{
        const participantExists= await db.collection("participants").findOne({name: participant.name});
        if(participantExists){
            res.sendStatus(409);
            return;
        }

        await db.collection("participants").insertOne({
            name: participant.name, 
            lastStatus: Date.now()
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
        res.status(500).send(error.message);
    }
});

// /messages
app.post("/messages", async (req, res) => {
    const serverMessage = req.body;
    const user = req.headers.user;

    try {
        const validation = messageFormat.validate(serverMessage, { abortEarly: false });

        const message = {
            from: user,
            ...serverMessage,
            time: dayjs().format("HH:mm:ss")
        };

        if (validation.error) {
            const errors = validation.error.details.map((detail) => detail.message);
            res.status(422).send(errors);
            return;
        }

        const participantExists = await db.collection("participants").findOne({ name: user });

        if (!participantExists) {
            res.sendStatus(422);
            return;
        }

        await db.collection("messages").insertOne(message);
        res.sendStatus(201);

    } catch (error) {
        res.status(500).send(error.message);
    }
});
app.get("/messages", async (req, res)=>{
    const limit=req.query.limit;
    const {user}=req.headers;

    try{
        const messages = await db.collection("messages").find({ $or: [{ from: user }, { to: "Todos" }, { to: user }] }).toArray();
        
        if (!limit) return res.send(messages);
        
        if (limit > 0 && parseInt(limit)!== "NaN") {
            const dados = messages.reverse().slice(0, parseInt(limit));
            return res.send(dados);
        }else{
            return res.sendStatus(422);
        }
        
    }catch(error){
        res.status(500).send(error.message);
    }
});

// /status
app.post("/status", async (req, res) =>{
    const user = req.headers.user;

    try{
        const existing=await db.collection("participants").findOne({name: user});

        if(!existing){
            return res.sendStatus(404);
        }

        await db.collection("participants").updateOne({name: user},{$set:{lastStatus:Date.now()}});

        res.sendStatus(200);
    }catch(error){
        res.status(500).send(error.message);
    }
});

// remoção automática
setInterval(async ()=>{
    const seconds=Date.now()-10000;

    try{
        const inactivity=await db.collection("participants").find({lastStatus: {$lte: seconds}}).toArray();

        if(inactivity.length>0){
            const inactivityMessages=inactivity.map(
                (inactivity)=>{
                    return {
                        from: inactivity.name,
                        to: "Todos",
                        text: "sai da sala...",
                        type: "status",
                        time: dayjs().format("HH:mm:ss")
                    };

                }
            );

            await db.collection("messages").insertMany(inactivityMessages);
            await db.collection("participants").deleteMany({lastStatus: {$lte: seconds}});
        }
    }catch(error){
        res.status(500).send(error.message);
    }
},15000);

app.listen(5000, ()=>console.log("Running"));