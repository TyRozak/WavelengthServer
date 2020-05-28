import { Room, Client, } from "colyseus";
import { Schema, type, ArraySchema , filter} from "@colyseus/schema";
import * as cardData from "../wavelengthCards.json";

export class Player extends Schema {
   
    @type("string")
    name = "";

    @type("string")
    color = "#FFF";

    @type("string")
    id = "";

    @type("number")
    team = 1;

    @type("number")
    rotation = 0;

    @type("boolean")
    isGameController = false;

    @type("boolean")
    isPsychic = false;

    constructor(id:string, name:string, color:string, team?:number)
    {
        super();
        this.id = id;
        this.name = name;
        this.color = color;
        this.team = team;
        this.rotation = 0;
    }
}



export class Card extends Schema {

    @type("string")
    textLeft = "";

    @type("string")
    textRight = "";

    @type("string")
    colorLeft = "";

    @type("string")
    colorRight = "";

    constructor()
    {
        super();
        var rnd = Math.floor(Math.random() * 252); 
        var rnd2 =Math.floor(Math.random() * 7); 
        this.textLeft = cardData.cards[rnd].textLeft;
        this.textRight = cardData.cards[rnd].textRight;
        this.colorLeft = cardData.colorPairs[rnd2].colorLeft;
        this.colorRight = cardData.colorPairs[rnd2].colorRight;
    }
}


export class Rotation extends Schema {
    @filter(function(this: Rotation, client: any, value: number, root: State){
        if(root.currentPsychicObj.id == client.sessionId)
            return true;
        return false;
    })
    @type("number")
    angle: number;
}

export class State extends Schema {
    
    //-----------------------------------------------------------------------------------------------//
    //Variables for Exporting
    @type([Player])
    allplayers = new ArraySchema<Player>(
    new Player("open", "Open Slot", "transparent",1),
    new Player("open", "Open Slot", "transparent",2),
    new Player("open", "Open Slot", "transparent",1),
    new Player("open", "Open Slot", "transparent",2),
    new Player("open", "Open Slot", "transparent",1),
    new Player("open", "Open Slot", "transparent",2),
    new Player("open", "Open Slot", "transparent",1),
    new Player("open", "Open Slot", "transparent",2),
    new Player("open", "Open Slot", "transparent",1),
    new Player("open", "Open Slot", "transparent",2));

    @type("string")
    currentPhase = "Pre-Game";

    @type("number")
    currentPlayingTeam = 2;

    @type("string")
    error = "";

    @type(Card)
    currentCard:Card;

    @type("number")
    currentRotationGoal = 0;

    @type(Rotation)
    currentRotationGoalForPsychic = new Rotation();

    @type("number")
    team1Score:number;

    @type("number")
    team2Score:number;

    @type("boolean")
    revealed = false;

    @type("boolean")
    leftButtonClicked = false;

    @type("number")
    maxPoints = 0;
    //End of Variable for Exporting
    //-----------------------------------------------------------------------------------------------//

    //-----------------------------------------------------------------------------------------------//
    //Variables for Internal Use
    alreadyBeenAPsychic = [];
    hasBeenGameController = [];
    currentPsychicObj : Player;
    isFirstPlayer = true;
    currentPsychic = null;
    currentTeam1Controller = null;
    currentTeam2Controller = null;
    availableColors = new Array(
        "#00A4CC",
        "#D198C5", 
        "#FCF951", 
        "#990011", 
        "#2232c2",
        "#000080", 
        "#00bcd4", 
        "#53A567", 
        "#CC8899", 
        "#CC5500");

    //End of Variable for Internal Use
    //-----------------------------------------------------------------------------------------------//

    //-----------------------------------------------------------------------------------------------//
    //Player Stuff
    createPlayer (id: string, name:string) {

        var color = this.availableColors[this.allplayers.filter(x=> x.id!="open").length];

        var player = new Player(id, name, color);
        console.log("Created Player: id: "+ id + ", name: " + name + ", color " + color);

        if(this.isFirstPlayer){
            this.isFirstPlayer = false;
            player.isGameController = true;
        }

        
        var index = this.removeFirstOpenAndReplace(player);
        if(this.allplayers.filter(x => x.team == 1).length > this.allplayers.filter(x => x.team == 2).length)
        {
            this.allplayers[index].team = 2;
            console.log("Assigned to Team 2");
        }
        else{
            this.allplayers[index].team = 1;
            console.log("Assigned to Team 1");
        }

    }

    removeFirstOpenAndReplace(player: Player)
    {
        for(var index in this.allplayers){
            if(this.allplayers[index].id == "open")
            {
                this.allplayers[index] = player;
                return index;
            }
        }
    }

    removePlayer (id: string) {

        for(var i = 0;i< this.allplayers.length;i++)
        {
            if(this.allplayers[i].id == id)
            {
                console.log("about to remove: " + JSON.stringify(this.allplayers[i]))
                this.allplayers.splice(i,1);
                return;
            }
        }
    }
    //End of Player Stuff
    //-----------------------------------------------------------------------------------------------//

    //-----------------------------------------------------------------------------------------------//
    //Game State Stuff
    advancePhase()
    {
        if(this.currentPhase == "Pre-Game")
        {
            this.startGame();
        }
        else if(this.currentPhase == "Psychic")
        {
            this.startTeamPhase();
        }
        else if(this.currentPhase == "Team")
        {
            this.startSidePhase();   
        }
        else if(this.currentPhase == "Side")
        {
            this.startScoringPhase();   
        }
        else if(this.currentPhase == "Scoring")
        {
            if(this.revealed)
            {
                this.startNextTurn();   
                this.revealed = false;
            }
            else
            {
                this.revealed = true;
                setTimeout(()=>{
                    //0 Max Points means no end score
                    if(this,this.maxPoints != 0)
                    {
                        if(this.team1Score == this.team2Score && this.team1Score > this.maxPoints)
                        {
                            this.moveToWinState(0);
                            return;
                        }
                        else if(this.team1Score >= this.maxPoints)
                        {
                            this.moveToWinState(1);
                            return;
                        }
                        else if (this.team2Score >= this.maxPoints)
                        {
                            this.moveToWinState(2);
                            return;
                        }
                    }
                }, 3000)
            }
        }
    }


    startGame()
    {   
        if(this.currentPhase != "Pre-Game" &&this.currentPhase != "Team1Winner" &&this.currentPhase != "Team2Winner" &&this.currentPhase != "TieWinner")
            return;

        console.log("Starting Game");
        if(this.allplayers.filter(x => x.team == 1).length <2 || this.allplayers.filter(x => x.team == 2).length <2)
        {
            this.error = "You need at least 2 players per team to start the game!";
            return;
        }
        this.error = "";

        this.allplayers = this.allplayers.filter(x => x.id != "open")

        this.team1Score = 0;
        this.team2Score = 0;

        //Assign a random starting psychic from that team
        this.getNewPsychic();
        this.startPsychicPhase();
    }

    getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    startPsychicPhase()
    {
        console.log("Starting Psychic Phase");

        this.currentCard = new Card();

        this.currentPlayingTeam = ((this.currentPlayingTeam +1)%2+1);
        this.currentRotationGoalForPsychic.angle = this.getRandomInt(-80,80);

        this.currentPhase = "Psychic";
    }

    getNewPsychic()
    {
        console.log("Getting New Psychic");
        if(this.currentPsychicObj)
            this.currentPsychicObj.isPsychic = false;

        for(var item in this.allplayers)
        {
            //console.log("Checking if already been a psychic");
            //console.log("Already been a psychic: " +JSON.stringify( this.alreadyBeenAPsychic));

            //Skip if they have already been a psychic
            if(this.alreadyBeenAPsychic.includes(this.allplayers[item]))
            {
                //console.log("Skipping this player as they have already been a psychic: " + JSON.stringify(this.allplayers[item]))
                continue;
            }
            
            //For the first person we find, add them to the list of psychics and return
            if(this.allplayers[item].team == this.currentPlayingTeam)
            {
                this.alreadyBeenAPsychic.push(this.allplayers[item]);
                this.currentPsychicObj = this.allplayers[item];
                this.currentPsychicObj.isPsychic = true;
                this.currentPsychic = this.currentPsychicObj;
                console.log("Assigning Psychic: " + JSON.stringify(this.currentPsychic));
    
                this.assignNewTeamControllers(false, false);
                return;
            }
        }

        //If we get through the whole list of team members and everyone has been a psychic, then reset the list for your team
        //and try again
        this.alreadyBeenAPsychic = this.alreadyBeenAPsychic.filter(x => x.team != this.currentPlayingTeam);
        
        //console.log("Already been a psychic after clear: " + JSON.stringify(this.alreadyBeenAPsychic))
        this.getNewPsychic();
    }

    assignNewTeamControllers(keepTeam1, keepTeam2)
    {
        console.log("Assigning New Controllers");
        var team1Assigned = keepTeam1;
        var team2Assigned = keepTeam2;

        for(var i in this.allplayers)
        {
            if(keepTeam1 && this.allplayers[i].team == 1 )
            {
                continue;
            }
            if(keepTeam2 && this.allplayers[i].team == 2 )
            {
                continue;
            }
            this.allplayers[i].isGameController = false;
        }

        //First player that is not a psychic and has not been a controller, for each team
        for(var i in this.allplayers)
        {
            var item = this.allplayers[i];
            if(!item.isPsychic && this.hasBeenGameController.indexOf(item) == -1)
            {
                if(item.team == 1 && !team1Assigned)
                {
                    console.log("Assigning new Game Controller for Team 1: " + JSON.stringify(item));
                    this.currentTeam1Controller = item;
                    item.isGameController = true;
                    this.hasBeenGameController.push(item);
                    team1Assigned = true;
                    continue;
                }
                if(item.team == 2 && !team2Assigned)
                {
                    console.log("Assigning new Game Controller for Team 2: " + JSON.stringify(item));
                    this.currentTeam2Controller = item;
                    item.isGameController = true;
                    this.hasBeenGameController.push(item);
                    team2Assigned = true;
                    continue;
                }
            }
        }
        if(!team1Assigned)
        {
            this.hasBeenGameController = this.hasBeenGameController.filter(x => x.team != 1);
        }
        if(!team2Assigned)
        {
            this.hasBeenGameController = this.hasBeenGameController.filter(x => x.team != 2);
        }
        if(team1Assigned&& team2Assigned)
        {
            return;
        }
        else
        {
            this.assignNewTeamControllers(team1Assigned, team2Assigned);
        }
    }

    startTeamPhase()
    {
        console.log("Starting Team Phase");
        this.currentPhase = "Team";
    }

    startSidePhase()
    {
        console.log("Starting Side Phase");
        this.currentPhase = "Side"
    }

    startScoringPhase()
    {
        console.log("Starting Scoring Phase");
        this.currentRotationGoal = this.currentRotationGoalForPsychic.angle;
        this.currentPhase = "Scoring";
    }

    moveToWinState(winningTeam)
    {
        if(winningTeam == 0)
            this.currentPhase = "TieWinner";
        else if(winningTeam == 1)
            this.currentPhase = "Team1Winner";
        else if(winningTeam == 2)
            this.currentPhase = "Team2Winner";   
    }

    startNextTurn()
    {
        console.log("Starting Next Turn");

        if(this.currentPhase == "TieWinner" || this.currentPhase == "Team1Winner" || this.currentPhase == "Team2Winner")
            return;

        this.revealed = false;
        if(this.currentPlayingTeam == 1)
            this.currentPlayingTeam = 2;
        else
            this.currentPlayingTeam = 1;
        
        this.hasCalculatedScore = false;
        this.getNewPsychic();
        this.startPsychicPhase();
    }

    hasCalculatedScore = false;
    calculateNewScore()
    {
        console.log("Calculating New Score");
        if(this.hasCalculatedScore)
            return;
        
        var angle = this.currentPlayingTeam == 1? this.currentTeam1Controller.rotation: this.currentTeam2Controller.rotation;
    
        console.log("Angle: " + angle);
        console.log("Rotation Goal For Psychic: " + this.currentRotationGoalForPsychic.angle)

        var AbsoluteAngleDif = 0;
        
        if ((this.currentRotationGoalForPsychic.angle > 0 && angle > 0) || 
            (this.currentRotationGoalForPsychic.angle < 0 && angle < 0)) {
            AbsoluteAngleDif = Math.abs(this.currentRotationGoalForPsychic.angle) - Math.abs(angle);
            console.log("First Condition");
        }
        else if (this.currentRotationGoalForPsychic.angle >= 0 && angle <= 0) {
            AbsoluteAngleDif = angle - this.currentRotationGoalForPsychic.angle;
            console.log("Second Condition");
        }
        else if (this.currentRotationGoalForPsychic.angle <= 0 && angle >= 0) {
            AbsoluteAngleDif = this.currentRotationGoalForPsychic.angle - angle;
            console.log("Third Condition");
        }

        var angleDif = 0;
        if(angle <  this.currentRotationGoal)
            angleDif = AbsoluteAngleDif
        else   
            angleDif = -AbsoluteAngleDif;

        var mainTeamPoints = 0;
        var offTeamPoints = 0;
        var isLeft = this.leftButtonClicked;

        console.log("AbsoluteAngleDif: " + AbsoluteAngleDif);
        console.log("AngleDif: " + angleDif);

        if(angleDif >= 12.7 && angleDif < 20)
        {
            mainTeamPoints = 2;
            if(isLeft)
                offTeamPoints = 1;
        }
        else if(angleDif >= 4.6 && angleDif < 12.7)
        {
            mainTeamPoints = 3;
            if(isLeft)
                offTeamPoints = 1;
        }
        else if(angleDif >= -3.8 && angleDif < 4.6)
        {
            mainTeamPoints = 4;
        }
        else if(angleDif >= -11.8 && angleDif < -3.8)
        {
            mainTeamPoints = 3;
            if(!isLeft)
                offTeamPoints = 1;
        }
        else if(angleDif >= -19.4 && angleDif < -11.8)
        {
            mainTeamPoints = 2;
            if(!isLeft)
                offTeamPoints = 1;
        }
        else
        {
            if(angleDif < 0 && !isLeft)
                offTeamPoints = 1;
            else if(angleDif > 0 && isLeft)
                offTeamPoints = 1;

        }
        
        if(this.currentPlayingTeam == 1)
        {
            this.team1Score += mainTeamPoints;
            this.team2Score += offTeamPoints
        }
        else
        {
            this.team2Score += mainTeamPoints;
            this.team1Score += offTeamPoints
        }

        console.log("Main Team Points: " + mainTeamPoints);
        console.log("Off Team Point: " + offTeamPoints);

        console.log("Team 1 New Score: " + this.team1Score);
        console.log("Team 2 New Score: " + this.team2Score);
    }
    //End of Game State Stuff
    //-----------------------------------------------------------------------------------------------//
}

export class WavelengthRoom extends Room<State> {
    maxClients = 10;

    onCreate (options) {
        console.log("StateHandlerRoom created!", options);
        this.setState(new State());
        if(!options.score)
            options.score = 10;
        else
            this.state.maxPoints = options.score;
    }

    onJoin (client: Client, options:any) {
        console.log("Player Joining: "  + options.sessionId)

        this.state.createPlayer(client.sessionId, options.name);
    }

    async onLeave (client) {
        console.log("Player Leaving: " + client.sessionId);

        this.state.removePlayer(client.sessionId);
        await this.allowReconnection(client, 20);
    }

    onMessage (client, data) {

        console.log("Command Received: " + data.command);
        console.log(data);

        if(data.command == "nextTurn")
        {
            this.state.advancePhase();
            return;
        }
        else if(data.command == "updateAngle")
        {
            for(var index in this.state.allplayers)
            {
                if(this.state.allplayers[index].id == data.playerId)
                {
                    this.state.allplayers[index].rotation = data.angle;
                    break;
                }
            }
        }
        else if(data.command == "startGame" || data.command == "restartGame")
        {
            this.state.startGame();
        }
        else if(data.command == "reveal")
        {
            this.state.revealed = true;
        }
        else if(data.command == "score")
        {
            this.state.calculateNewScore();
        }
        else if(data.command == "clickleft")
        {
            this.state.leftButtonClicked = data.leftClick;
        }
    }

    onDispose () {
        console.log("Dispose StateHandlerRoom");
    }

}
