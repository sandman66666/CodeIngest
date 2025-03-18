// In-memory store for the application
const { v4: uuidv4 } = require('uuid');

class InMemoryStore {
  constructor() {
    this.users = [
      {
        id: 'user-default',
        email: 'demo@example.com',
        name: 'Demo User',
        createdAt: new Date()
      }
    ];
    this.repositories = [];
    this.analyses = [];
  }

  // Singleton pattern
  static getInstance() {
    if (!InMemoryStore.instance) {
      InMemoryStore.instance = new InMemoryStore();
    }
    return InMemoryStore.instance;
  }

  // User methods
  getUsers() {
    return this.users;
  }

  // Repository methods
  getRepositories(userId) {
    return this.repositories.filter(repo => repo.userId === userId);
  }

  getRepositoryById(id) {
    return this.repositories.find(repo => repo.id === id);
  }

  getRepositoryByOwnerAndName(userId, owner, name) {
    return this.repositories.find(
      repo => repo.userId === userId && 
              repo.owner.toLowerCase() === owner.toLowerCase() && 
              repo.name.toLowerCase() === name.toLowerCase()
    );
  }

  createRepository(repository) {
    this.repositories.push(repository);
    return repository;
  }

  updateRepository(id, updatedRepo) {
    const index = this.repositories.findIndex(repo => repo.id === id);
    if (index !== -1) {
      this.repositories[index] = { ...this.repositories[index], ...updatedRepo };
      return this.repositories[index];
    }
    return null;
  }

  // Analysis methods
  getAnalysesByRepositoryId(repositoryId) {
    return this.analyses.filter(analysis => analysis.repositoryId === repositoryId);
  }

  getAnalysisById(id) {
    return this.analyses.find(analysis => analysis.id === id);
  }

  createAnalysis(analysis) {
    this.analyses.push(analysis);
    return analysis;
  }

  updateAnalysis(id, updatedAnalysis) {
    const index = this.analyses.findIndex(analysis => analysis.id === id);
    if (index !== -1) {
      this.analyses[index] = { ...this.analyses[index], ...updatedAnalysis };
      return this.analyses[index];
    }
    return null;
  }
}

module.exports = InMemoryStore;
