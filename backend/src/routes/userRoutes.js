import User from '../controllers/userController.js';
import express from "express";

const router = express.Router();

router.post('/signup', async (req, res) => {
    const b = req.body;
    try{
        const result = await User.createUser(b.username, b.password, b.firstName, b.middleName, b.lastName, b.suffix, b.userRole);
        res.status(200).send({message: 'Successfully created user', body: result});
    }
    catch(e){
        res.status(404).send({message: 'Error creating user', body: e});
    }
});

router.post('/login', async (req, res) => {
  console.log(req.body.username);
    const result = await User.login(req.body.username, req.body.password);
    console.log(result);
    if(!result.err){
        const user = result.user[0];
         req.session.user = {
            user_id: user.user_id, 
            username: user.username, 
            user_role: user.user_role,
            first_name: user.first_name,
            middle_name: user.middle_name,
            last_name: user.last_name,
            suffix: user.suffix
        };

        req.session.save(err =>{
            if (err) return res.status(500).send(err);
            console.log("Session verified inside save:", req.session.user);
            res.status(200).send({err: false, message: 'Login Successful'});
        })
    }
    else{
        res.send({message: result.message});
    }
});

router.get('/session-user', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ 
      error: "No user in session", 
      id: req.sessionID 
    });
  }
});

router.get('/logout', (req, res) => {

  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
   
      return res.status(500).send({message: 'Error logging out'});
    } else {

      res.clearCookie('connect.sid'); 

      
      res.status(200).send({message: 'Successfully logged out'});

    }
  });
});

// --- BAGONG ROUTE PARA SA ACCOUNT LIST ---
router.get('/users', User.getUsers);
router.delete('/users/:id', User.deleteUser);
router.get('/workers', User.getWorkers);
router.post('/workers', User.addWorker);
router.put('/workers/:id', User.updateWorker);

export default router;