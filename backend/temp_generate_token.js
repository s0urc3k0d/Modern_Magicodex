const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function generateAdminToken() {
  const prisma = new PrismaClient();
  
  try {
    // Chercher l'utilisateur admin
    const user = await prisma.user.findUnique({
      where: { email: 'admin@magicodex.com' }
    });
    
    if (!user) {
      console.log('❌ Utilisateur admin@magicodex.com non trouvé');
      return;
    }
    
    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare('admin123456', user.password);
    
    if (!isValidPassword) {
      console.log('❌ Mot de passe incorrect');
      return;
    }
    
    if (!user.isAdmin) {
      console.log('❌ L\'utilisateur n\'est pas administrateur');
      return;
    }
    
    // Générer le token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );
    
    console.log('✅ Token généré pour', user.email);
    console.log('Bearer ' + token);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

generateAdminToken();
